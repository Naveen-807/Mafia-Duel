#![no_std]

//! # Mafia Duel — 8-Player Edition
//!
//! Up to 8 players join a room. Any empty slots are filled by AI.
//! Minimum 1 human; maximum 8.
//!
//! Roles for 8 players: 2xMafia | 1xDoctor | 1xSheriff | 4xVillager
//!
//! Game loop: LOBBY -> NIGHT -> DAY -> NIGHT -> ... until win condition
//!
//! Night actions (per role):
//!   Mafia   -> kill a living Town player
//!   Doctor  -> protect a living player (can be self)
//!   Sheriff -> investigate a living player (not self)
//!   Villager -> no night action (auto-pass)
//!
//! Day: all living players vote; highest vote count is eliminated.
//!
//! Win conditions:
//!   Town wins  -> all Mafia eliminated
//!   Mafia wins -> Mafia count >= Town count
//!
//! AI decisions are computed deterministically at resolve time via PRNG.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, Vec,
};

// --- Role constants ---
pub const ROLE_MAFIA: u32 = 0;
pub const ROLE_VILLAGER: u32 = 1;
pub const ROLE_DOCTOR: u32 = 2;
pub const ROLE_SHERIFF: u32 = 3;

// --- Phase constants ---
pub const PHASE_LOBBY: u32 = 0;
pub const PHASE_NIGHT: u32 = 1;
pub const PHASE_DAY: u32 = 2;
pub const PHASE_OVER: u32 = 3;

// --- Team constants ---
pub const TEAM_MAFIA: u32 = 0;
pub const TEAM_TOWN: u32 = 1;

// --- Config ---
pub const MAX_PLAYERS: u32 = 8;
pub const GAME_TTL_LEDGERS: u32 = 518_400;

/// Role template: 2 Mafia, 1 Doctor, 1 Sheriff, 4 Villager
const ROLE_TEMPLATE: [u32; 8] = [
    ROLE_MAFIA, ROLE_MAFIA,
    ROLE_DOCTOR, ROLE_SHERIFF,
    ROLE_VILLAGER, ROLE_VILLAGER, ROLE_VILLAGER, ROLE_VILLAGER,
];

// --- Storage keys ---
#[contracttype]
pub enum DataKey {
    Game(u32),
    Admin,
    GameHubAddress,
}

// --- Data types ---

/// One player slot (human or AI).
#[contracttype]
#[derive(Clone)]
pub struct Slot {
    /// None = AI-controlled slot
    pub addr: Option<Address>,
    pub role: u32,
    pub alive: bool,
    /// Night target or day vote target index; None = pass/abstain
    pub action: Option<u32>,
    /// Has this slot submitted an action this phase?
    pub submitted: bool,
}

/// Full game state.
#[contracttype]
#[derive(Clone)]
pub struct Game {
    pub creator: Address,
    pub slots: Vec<Slot>,
    /// Number of human players currently in the room (1-8)
    pub human_count: u32,
    pub phase: u32,
    /// Increments each time a day phase resolves
    pub day: u32,
    /// TEAM_MAFIA or TEAM_TOWN once game ends
    pub winner: Option<u32>,
    // Last-night results
    pub last_killed: Option<u32>,
    pub last_saved: bool,
    pub last_investigated: Option<u32>,
    pub invest_is_mafia: bool,
    // Last-day result
    pub last_voted_out: Option<u32>,
    /// Points wagered (informational)
    pub wager: i128,
}

// --- Errors ---
#[contracterror]
#[derive(Copy, Clone)]
pub enum MafiaError {
    GameNotFound = 1,
    GameFull = 2,
    AlreadyJoined = 3,
    NotInGame = 4,
    WrongPhase = 5,
    AlreadyActed = 6,
    InvalidTarget = 7,
    NotAlive = 8,
    GameAlreadyOver = 9,
    NotCreator = 10,
    SessionExists = 11,
}

// --- Game Hub client ---
#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );
    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

// --- Contract ---
#[contract]
pub struct MafiaDuelContract;

#[contractimpl]
impl MafiaDuelContract {
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHubAddress, &game_hub);
    }

    // -- Helpers --

    fn hub_client(env: &Env) -> GameHubClient {
        let addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .unwrap();
        GameHubClient::new(env, &addr)
    }

    fn store(env: &Env, session_id: u32, game: &Game) {
        let key = DataKey::Game(session_id);
        env.storage().temporary().set(&key, game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }

    fn seed_prng(env: &Env, session_id: u32, day: u32, phase: u32) {
        let mut b = [0u8; 12];
        b[0..4].copy_from_slice(&session_id.to_be_bytes());
        b[4..8].copy_from_slice(&day.to_be_bytes());
        b[8..12].copy_from_slice(&phase.to_be_bytes());
        let hash: BytesN<32> = env.crypto().keccak256(&Bytes::from_array(env, &b)).into();
        env.prng().seed(hash.into());
    }

    fn pick_random(env: &Env, list: &Vec<u32>) -> Option<u32> {
        if list.is_empty() {
            return None;
        }
        let idx = env.prng().gen_range::<u64>(0..list.len() as u64) as u32;
        Some(list.get(idx).unwrap())
    }

    fn pick_excluding(env: &Env, list: &Vec<u32>, exclude: u32) -> Option<u32> {
        let mut filtered = Vec::new(env);
        for i in 0..list.len() {
            let v = list.get(i).unwrap();
            if v != exclude {
                filtered.push_back(v);
            }
        }
        Self::pick_random(env, &filtered)
    }

    fn living_lists(env: &Env, game: &Game) -> (Vec<u32>, Vec<u32>) {
        let mut all = Vec::new(env);
        let mut town = Vec::new(env);
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive {
                all.push_back(i);
                if s.role != ROLE_MAFIA {
                    town.push_back(i);
                }
            }
        }
        (all, town)
    }

    // -- Public functions --

    /// Create a new 8-player room. Creator occupies slot 0; remaining 7 are AI.
    pub fn create_game(
        env: Env,
        session_id: u32,
        creator: Address,
        wager: i128,
    ) -> Result<(), MafiaError> {
        creator.require_auth();
        if env.storage().temporary().has(&DataKey::Game(session_id)) {
            return Err(MafiaError::SessionExists);
        }

        let mut slots = Vec::new(&env);
        slots.push_back(Slot {
            addr: Some(creator.clone()),
            role: 0,
            alive: true,
            action: None,
            submitted: false,
        });
        for _ in 1..MAX_PLAYERS {
            slots.push_back(Slot {
                addr: None,
                role: 0,
                alive: true,
                action: None,
                submitted: false,
            });
        }

        Self::store(
            &env,
            session_id,
            &Game {
                creator,
                slots,
                human_count: 1,
                phase: PHASE_LOBBY,
                day: 0,
                winner: None,
                last_killed: None,
                last_saved: false,
                last_investigated: None,
                invest_is_mafia: false,
                last_voted_out: None,
                wager,
            },
        );
        Ok(())
    }

    /// Join an existing lobby. Fills the next open AI slot with this human.
    pub fn join_game(
        env: Env,
        session_id: u32,
        player: Address,
    ) -> Result<(), MafiaError> {
        player.require_auth();
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&DataKey::Game(session_id))
            .ok_or(MafiaError::GameNotFound)?;

        if game.phase != PHASE_LOBBY {
            return Err(MafiaError::WrongPhase);
        }
        if game.human_count >= MAX_PLAYERS {
            return Err(MafiaError::GameFull);
        }
        for i in 0..game.slots.len() {
            if let Some(ref a) = game.slots.get(i).unwrap().addr {
                if *a == player {
                    return Err(MafiaError::AlreadyJoined);
                }
            }
        }

        let slot_idx = game.human_count;
        let mut s = game.slots.get(slot_idx).unwrap();
        s.addr = Some(player);
        game.slots.set(slot_idx, s);
        game.human_count += 1;

        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// Creator starts the game: shuffles roles onto all 8 slots, enters night 1.
    pub fn begin_game(
        env: Env,
        session_id: u32,
        caller: Address,
    ) -> Result<(), MafiaError> {
        caller.require_auth();
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&DataKey::Game(session_id))
            .ok_or(MafiaError::GameNotFound)?;

        if game.creator != caller {
            return Err(MafiaError::NotCreator);
        }
        if game.phase != PHASE_LOBBY {
            return Err(MafiaError::WrongPhase);
        }

        Self::seed_prng(&env, session_id, 0, 0);
        let mut roles = ROLE_TEMPLATE;
        for i in (1..8usize).rev() {
            let j = env.prng().gen_range::<u64>(0..=(i as u64)) as usize;
            roles.swap(i, j);
        }
        for i in 0..MAX_PLAYERS {
            let mut s = game.slots.get(i).unwrap();
            s.role = roles[i as usize];
            game.slots.set(i, s);
        }

        game.phase = PHASE_NIGHT;
        game.day = 1;

        Self::hub_client(&env).start_game(
            &env.current_contract_address(),
            &session_id,
            &game.creator,
            &game.creator,
            &game.wager,
            &game.wager,
        );

        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// Submit an action for the current phase.
    ///
    /// Night: Mafia -> kill target idx | Doctor -> protect target idx
    ///        Sheriff -> investigate target idx | Villager -> pass (u32::MAX)
    /// Day:   Vote -> target idx | Abstain -> u32::MAX
    pub fn submit_action(
        env: Env,
        session_id: u32,
        player: Address,
        target: u32,
    ) -> Result<(), MafiaError> {
        player.require_auth();
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&DataKey::Game(session_id))
            .ok_or(MafiaError::GameNotFound)?;

        if game.phase != PHASE_NIGHT && game.phase != PHASE_DAY {
            return Err(MafiaError::WrongPhase);
        }
        if game.winner.is_some() {
            return Err(MafiaError::GameAlreadyOver);
        }

        let mut my_idx: Option<u32> = None;
        for i in 0..game.slots.len() {
            if let Some(ref a) = game.slots.get(i).unwrap().addr {
                if *a == player {
                    my_idx = Some(i);
                    break;
                }
            }
        }
        let idx = my_idx.ok_or(MafiaError::NotInGame)?;
        let my_slot = game.slots.get(idx).unwrap();

        if !my_slot.alive {
            return Err(MafiaError::NotAlive);
        }
        if my_slot.submitted {
            return Err(MafiaError::AlreadyActed);
        }

        let action = if target == u32::MAX {
            None
        } else {
            if target >= MAX_PLAYERS {
                return Err(MafiaError::InvalidTarget);
            }
            let ts = game.slots.get(target).unwrap();
            if !ts.alive {
                return Err(MafiaError::InvalidTarget);
            }
            if target == idx
                && game.phase == PHASE_NIGHT
                && (my_slot.role == ROLE_MAFIA || my_slot.role == ROLE_SHERIFF)
            {
                return Err(MafiaError::InvalidTarget);
            }
            Some(target)
        };

        let mut s = my_slot;
        s.action = action;
        s.submitted = true;
        game.slots.set(idx, s);

        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// Resolve the current phase. Anyone can call.
    /// AI slots get PRNG-computed actions; human non-submitters are treated as pass.
    pub fn resolve(env: Env, session_id: u32) -> Result<(), MafiaError> {
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&DataKey::Game(session_id))
            .ok_or(MafiaError::GameNotFound)?;

        if game.phase != PHASE_NIGHT && game.phase != PHASE_DAY {
            return Err(MafiaError::WrongPhase);
        }
        if game.winner.is_some() {
            return Err(MafiaError::GameAlreadyOver);
        }

        Self::seed_prng(&env, session_id, game.day, game.phase);

        if game.phase == PHASE_NIGHT {
            Self::resolve_night(&env, &mut game);
            game.phase = PHASE_DAY;
        } else {
            Self::resolve_day(&env, &mut game);
            game.phase = PHASE_NIGHT;
            game.day += 1;
        }

        let (mut mafia_alive, mut town_alive) = (0u32, 0u32);
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive {
                if s.role == ROLE_MAFIA {
                    mafia_alive += 1;
                } else {
                    town_alive += 1;
                }
            }
        }

        if mafia_alive == 0 {
            game.winner = Some(TEAM_TOWN);
            game.phase = PHASE_OVER;
        } else if mafia_alive >= town_alive {
            game.winner = Some(TEAM_MAFIA);
            game.phase = PHASE_OVER;
        }

        if let Some(w) = game.winner {
            Self::hub_client(&env).end_game(&session_id, &(w == TEAM_TOWN));
        }

        Self::store(&env, session_id, &game);
        Ok(())
    }

    fn resolve_night(env: &Env, game: &mut Game) {
        let (living_all, living_town) = Self::living_lists(env, game);

        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if !s.alive || s.submitted || s.addr.is_some() {
                continue;
            }
            let action = match s.role {
                ROLE_MAFIA => Self::pick_random(env, &living_town),
                ROLE_DOCTOR => Self::pick_random(env, &living_all),
                ROLE_SHERIFF => Self::pick_excluding(env, &living_all, i),
                _ => None,
            };
            let mut us = s;
            us.action = action;
            us.submitted = true;
            game.slots.set(i, us);
        }

        let mut kill_target: Option<u32> = None;
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive && s.role == ROLE_MAFIA {
                if let Some(t) = s.action {
                    kill_target = Some(t);
                    break;
                }
            }
        }

        let mut save_target: Option<u32> = None;
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive && s.role == ROLE_DOCTOR {
                save_target = s.action;
                break;
            }
        }

        let mut invest_target: Option<u32> = None;
        let mut invest_is_mafia = false;
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive && s.role == ROLE_SHERIFF {
                if let Some(t) = s.action {
                    invest_target = Some(t);
                    invest_is_mafia = game.slots.get(t).unwrap().role == ROLE_MAFIA;
                }
                break;
            }
        }

        game.last_killed = kill_target;
        game.last_saved = false;
        game.last_voted_out = None;
        game.last_investigated = invest_target;
        game.invest_is_mafia = invest_is_mafia;

        if let Some(ki) = kill_target {
            if save_target == Some(ki) {
                game.last_saved = true;
            } else {
                let mut ds = game.slots.get(ki).unwrap();
                ds.alive = false;
                game.slots.set(ki, ds);
            }
        }

        for i in 0..MAX_PLAYERS {
            let mut s = game.slots.get(i).unwrap();
            s.action = None;
            s.submitted = false;
            game.slots.set(i, s);
        }
    }

    fn resolve_day(env: &Env, game: &mut Game) {
        let mut living = Vec::new(env);
        for i in 0..MAX_PLAYERS {
            if game.slots.get(i).unwrap().alive {
                living.push_back(i);
            }
        }

        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if !s.alive || s.submitted || s.addr.is_some() {
                continue;
            }
            let action = Self::pick_excluding(env, &living, i);
            let mut us = s;
            us.action = action;
            us.submitted = true;
            game.slots.set(i, us);
        }

        let mut counts = [0u32; 8];
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive {
                if let Some(t) = s.action {
                    counts[t as usize] += 1;
                }
            }
        }

        let mut max_v = 0u32;
        let mut elim: Option<u32> = None;
        for i in 0..8usize {
            let s = game.slots.get(i as u32).unwrap();
            if s.alive && counts[i] > max_v {
                max_v = counts[i];
                elim = Some(i as u32);
            }
        }

        game.last_voted_out = elim;
        game.last_killed = None;
        game.last_saved = false;

        if let Some(ei) = elim {
            let mut ds = game.slots.get(ei).unwrap();
            ds.alive = false;
            game.slots.set(ei, ds);
        }

        for i in 0..MAX_PLAYERS {
            let mut s = game.slots.get(i).unwrap();
            s.action = None;
            s.submitted = false;
            game.slots.set(i, s);
        }
    }

    /// Get full game state. Frontend shows only YOUR role during active play.
    pub fn get_game(env: Env, session_id: u32) -> Option<Game> {
        env.storage().temporary().get(&DataKey::Game(session_id))
    }

    // -- Admin --

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn get_hub(env: Env) -> Address {
        env.storage().instance().get(&DataKey::GameHubAddress).unwrap()
    }

    pub fn set_hub(env: Env, new_hub: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::GameHubAddress, &new_hub);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}
