#![no_std]

//! # Mafia Duel — Onchain ZK Commit-Reveal
//!
//! Night actions use SHA-256 commit-reveal verified fully on-chain:
//!
//!   1. PHASE_NIGHT_COMMIT — player calls submit_commitment(sha256(target||nonce)).
//!      Plaintext target stays hidden; only the hash is stored (hiding property).
//!   2. PHASE_NIGHT_REVEAL — player calls reveal_action(target, nonce).
//!      Contract recomputes sha256(target||nonce) and rejects mismatches (binding property).
//!   3. resolve() — executes verified actions; AI uses deterministic PRNG.
//!
//! Roles: 2 Mafia | 1 Doctor | 1 Sheriff | 4 Villager
//! Win:   Town wins when no Mafia remain. Mafia wins when Mafia >= Town.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, Vec,
};

pub const ROLE_MAFIA: u32    = 0;
pub const ROLE_VILLAGER: u32 = 1;
pub const ROLE_DOCTOR: u32   = 2;
pub const ROLE_SHERIFF: u32  = 3;

pub const PHASE_LOBBY: u32        = 0;
pub const PHASE_NIGHT_COMMIT: u32 = 1;
pub const PHASE_NIGHT_REVEAL: u32 = 2;
pub const PHASE_DAY: u32          = 3;
pub const PHASE_OVER: u32         = 4;

pub const TEAM_MAFIA: u32 = 0;
pub const TEAM_TOWN: u32  = 1;

pub const MAX_PLAYERS: u32      = 8;
pub const GAME_TTL_LEDGERS: u32 = 518_400;
pub const PASS_TARGET: u32      = u32::MAX;

const ROLE_TEMPLATE: [u32; 8] = [
    ROLE_MAFIA, ROLE_MAFIA,
    ROLE_DOCTOR, ROLE_SHERIFF,
    ROLE_VILLAGER, ROLE_VILLAGER, ROLE_VILLAGER, ROLE_VILLAGER,
];

#[contracttype]
pub enum DataKey {
    Game(u32),
    Admin,
    GameHubAddress,
}

#[contracttype]
#[derive(Clone)]
pub struct Slot {
    pub addr: Option<Address>,
    pub role: u32,
    pub alive: bool,
    pub action: Option<u32>,
    pub submitted: bool,
    pub commitment: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
pub struct Game {
    pub creator: Address,
    pub slots: Vec<Slot>,
    pub human_count: u32,
    pub phase: u32,
    pub day: u32,
    pub winner: Option<u32>,
    pub last_killed: Option<u32>,
    pub last_saved: bool,
    pub last_investigated: Option<u32>,
    pub invest_is_mafia: bool,
    pub last_voted_out: Option<u32>,
    pub wager: i128,
}

#[contracterror]
#[derive(Copy, Clone)]
pub enum MafiaError {
    GameNotFound    = 1,
    GameFull        = 2,
    AlreadyJoined   = 3,
    NotInGame       = 4,
    WrongPhase      = 5,
    AlreadyActed    = 6,
    InvalidTarget   = 7,
    NotAlive        = 8,
    GameAlreadyOver = 9,
    NotCreator      = 10,
    SessionExists   = 11,
    InvalidReveal   = 12,
    NoCommitment    = 13,
}

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

#[contract]
pub struct MafiaDuelContract;

#[contractimpl]
impl MafiaDuelContract {
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHubAddress, &game_hub);
    }

    fn hub_client(env: &Env) -> GameHubClient {
        let addr: Address = env.storage().instance().get(&DataKey::GameHubAddress).unwrap();
        GameHubClient::new(env, &addr)
    }

    fn store(env: &Env, session_id: u32, game: &Game) {
        let key = DataKey::Game(session_id);
        env.storage().temporary().set(&key, game);
        env.storage().temporary().extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
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
        if list.is_empty() { return None; }
        let idx = env.prng().gen_range::<u64>(0..list.len() as u64) as u32;
        Some(list.get(idx).unwrap())
    }

    fn pick_excluding(env: &Env, list: &Vec<u32>, exclude: u32) -> Option<u32> {
        let mut filtered = Vec::new(env);
        for i in 0..list.len() {
            let v = list.get(i).unwrap();
            if v != exclude { filtered.push_back(v); }
        }
        Self::pick_random(env, &filtered)
    }

    fn living_lists(env: &Env, game: &Game) -> (Vec<u32>, Vec<u32>) {
        let mut all  = Vec::new(env);
        let mut town = Vec::new(env);
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive {
                all.push_back(i);
                if s.role != ROLE_MAFIA { town.push_back(i); }
            }
        }
        (all, town)
    }

    fn compute_commitment(env: &Env, target: u32, nonce: u64) -> BytesN<32> {
        let mut raw = [0u8; 12];
        raw[0..4].copy_from_slice(&target.to_be_bytes());
        raw[4..12].copy_from_slice(&nonce.to_be_bytes());
        env.crypto().sha256(&Bytes::from_array(env, &raw)).into()
    }

    fn find_human_slot(game: &Game, player: &Address) -> Option<u32> {
        for i in 0..game.slots.len() {
            if let Some(ref a) = game.slots.get(i).unwrap().addr {
                if a == player { return Some(i); }
            }
        }
        None
    }

    fn all_alive_humans_submitted(game: &Game) -> bool {
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.addr.is_some() && s.alive && !s.submitted { return false; }
        }
        true
    }

    pub fn create_game(env: Env, session_id: u32, creator: Address, wager: i128) -> Result<(), MafiaError> {
        creator.require_auth();
        if env.storage().temporary().has(&DataKey::Game(session_id)) {
            return Err(MafiaError::SessionExists);
        }
        let mut slots = Vec::new(&env);
        slots.push_back(Slot { addr: Some(creator.clone()), role: 0, alive: true, action: None, submitted: false, commitment: None });
        for _ in 1..MAX_PLAYERS {
            slots.push_back(Slot { addr: None, role: 0, alive: true, action: None, submitted: false, commitment: None });
        }
        Self::store(&env, session_id, &Game {
            creator, slots, human_count: 1, phase: PHASE_LOBBY, day: 0,
            winner: None, last_killed: None, last_saved: false,
            last_investigated: None, invest_is_mafia: false,
            last_voted_out: None, wager,
        });
        Ok(())
    }

    pub fn join_game(env: Env, session_id: u32, player: Address) -> Result<(), MafiaError> {
        player.require_auth();
        let mut game: Game = env.storage().temporary().get(&DataKey::Game(session_id)).ok_or(MafiaError::GameNotFound)?;
        if game.phase != PHASE_LOBBY { return Err(MafiaError::WrongPhase); }
        if game.human_count >= MAX_PLAYERS { return Err(MafiaError::GameFull); }
        for i in 0..game.slots.len() {
            if let Some(ref a) = game.slots.get(i).unwrap().addr {
                if *a == player { return Err(MafiaError::AlreadyJoined); }
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

    pub fn begin_game(env: Env, session_id: u32, caller: Address) -> Result<(), MafiaError> {
        caller.require_auth();
        let mut game: Game = env.storage().temporary().get(&DataKey::Game(session_id)).ok_or(MafiaError::GameNotFound)?;
        if game.creator != caller { return Err(MafiaError::NotCreator); }
        if game.phase != PHASE_LOBBY { return Err(MafiaError::WrongPhase); }
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
        game.phase = PHASE_NIGHT_COMMIT;
        game.day   = 1;
        Self::hub_client(&env).start_game(
            &env.current_contract_address(), &session_id,
            &game.creator, &game.creator, &game.wager, &game.wager,
        );
        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// ZK Step 1 (hiding): store commitment = sha256(target_be || nonce_be).
    /// Auto-advances to PHASE_NIGHT_REVEAL once all alive humans commit.
    pub fn submit_commitment(
        env: Env,
        session_id: u32,
        player: Address,
        commitment: BytesN<32>,
    ) -> Result<(), MafiaError> {
        player.require_auth();
        let mut game: Game = env.storage().temporary().get(&DataKey::Game(session_id)).ok_or(MafiaError::GameNotFound)?;
        if game.phase != PHASE_NIGHT_COMMIT { return Err(MafiaError::WrongPhase); }
        if game.winner.is_some() { return Err(MafiaError::GameAlreadyOver); }
        let idx = Self::find_human_slot(&game, &player).ok_or(MafiaError::NotInGame)?;
        let mut s = game.slots.get(idx).unwrap();
        if !s.alive { return Err(MafiaError::NotAlive); }
        if s.submitted { return Err(MafiaError::AlreadyActed); }
        s.commitment = Some(commitment);
        s.submitted  = true;
        game.slots.set(idx, s);
        if Self::all_alive_humans_submitted(&game) {
            game.phase = PHASE_NIGHT_REVEAL;
            for i in 0..MAX_PLAYERS {
                let mut slot = game.slots.get(i).unwrap();
                if slot.addr.is_some() { slot.submitted = false; }
                game.slots.set(i, slot);
            }
        }
        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// ZK Step 2 (binding): reveal target+nonce; contract verifies sha256(target||nonce)==commitment.
    /// Returns InvalidReveal (#12) on mismatch — cannot change a committed target.
    pub fn reveal_action(
        env: Env,
        session_id: u32,
        player: Address,
        target: u32,
        nonce: u64,
    ) -> Result<(), MafiaError> {
        player.require_auth();
        let mut game: Game = env.storage().temporary().get(&DataKey::Game(session_id)).ok_or(MafiaError::GameNotFound)?;
        if game.phase != PHASE_NIGHT_REVEAL { return Err(MafiaError::WrongPhase); }
        if game.winner.is_some() { return Err(MafiaError::GameAlreadyOver); }
        let idx = Self::find_human_slot(&game, &player).ok_or(MafiaError::NotInGame)?;
        let mut s = game.slots.get(idx).unwrap();
        if !s.alive { return Err(MafiaError::NotAlive); }
        if s.submitted { return Err(MafiaError::AlreadyActed); }
        let stored = s.commitment.clone().ok_or(MafiaError::NoCommitment)?;
        let computed = Self::compute_commitment(&env, target, nonce);
        if computed != stored { return Err(MafiaError::InvalidReveal); }
        let action = if target == PASS_TARGET {
            None
        } else {
            if target >= MAX_PLAYERS { return Err(MafiaError::InvalidTarget); }
            let ts = game.slots.get(target).unwrap();
            if !ts.alive { return Err(MafiaError::InvalidTarget); }
            if target == idx && (s.role == ROLE_MAFIA || s.role == ROLE_SHERIFF) {
                return Err(MafiaError::InvalidTarget);
            }
            Some(target)
        };
        s.action    = action;
        s.submitted = true;
        game.slots.set(idx, s);
        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// Day vote (transparent by design — daytime discussion is public).
    pub fn submit_action(
        env: Env,
        session_id: u32,
        player: Address,
        target: u32,
    ) -> Result<(), MafiaError> {
        player.require_auth();
        let mut game: Game = env.storage().temporary().get(&DataKey::Game(session_id)).ok_or(MafiaError::GameNotFound)?;
        if game.phase != PHASE_DAY { return Err(MafiaError::WrongPhase); }
        if game.winner.is_some() { return Err(MafiaError::GameAlreadyOver); }
        let idx = Self::find_human_slot(&game, &player).ok_or(MafiaError::NotInGame)?;
        let s = game.slots.get(idx).unwrap();
        if !s.alive { return Err(MafiaError::NotAlive); }
        if s.submitted { return Err(MafiaError::AlreadyActed); }
        let action = if target == PASS_TARGET {
            None
        } else {
            if target >= MAX_PLAYERS { return Err(MafiaError::InvalidTarget); }
            let ts = game.slots.get(target).unwrap();
            if !ts.alive { return Err(MafiaError::InvalidTarget); }
            Some(target)
        };
        let mut ms = game.slots.get(idx).unwrap();
        ms.action    = action;
        ms.submitted = true;
        game.slots.set(idx, ms);
        Self::store(&env, session_id, &game);
        Ok(())
    }

    /// Advance phase: PHASE_NIGHT_REVEAL->PHASE_DAY, PHASE_DAY->PHASE_NIGHT_COMMIT.
    pub fn resolve(env: Env, session_id: u32) -> Result<(), MafiaError> {
        let mut game: Game = env.storage().temporary().get(&DataKey::Game(session_id)).ok_or(MafiaError::GameNotFound)?;
        if game.phase != PHASE_NIGHT_REVEAL && game.phase != PHASE_DAY { return Err(MafiaError::WrongPhase); }
        if game.winner.is_some() { return Err(MafiaError::GameAlreadyOver); }
        Self::seed_prng(&env, session_id, game.day, game.phase);
        if game.phase == PHASE_NIGHT_REVEAL {
            Self::resolve_night(&env, &mut game);
            game.phase = PHASE_DAY;
        } else {
            Self::resolve_day(&env, &mut game);
            game.phase = PHASE_NIGHT_COMMIT;
            game.day  += 1;
        }
        let (mut mafia_alive, mut town_alive) = (0u32, 0u32);
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive {
                if s.role == ROLE_MAFIA { mafia_alive += 1; } else { town_alive += 1; }
            }
        }
        if mafia_alive == 0 { game.winner = Some(TEAM_TOWN); game.phase = PHASE_OVER; }
        else if mafia_alive >= town_alive { game.winner = Some(TEAM_MAFIA); game.phase = PHASE_OVER; }
        if let Some(w) = game.winner {
            Self::hub_client(&env).end_game(&session_id, &(w == TEAM_TOWN));
        }
        Self::store(&env, session_id, &game);
        Ok(())
    }

    pub fn get_game(env: Env, session_id: u32) -> Option<Game> {
        env.storage().temporary().get(&DataKey::Game(session_id))
    }
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
    pub fn get_hub(env: Env) -> Address {
        env.storage().instance().get(&DataKey::GameHubAddress).unwrap()
    }
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
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

    fn resolve_night(env: &Env, game: &mut Game) {
        let (living_all, living_town) = Self::living_lists(env, game);
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if !s.alive || s.submitted || s.addr.is_some() { continue; }
            let action = match s.role {
                ROLE_MAFIA   => Self::pick_random(env, &living_town),
                ROLE_DOCTOR  => Self::pick_random(env, &living_all),
                ROLE_SHERIFF => Self::pick_excluding(env, &living_all, i),
                _            => None,
            };
            let mut us = s;
            us.action    = action;
            us.submitted = true;
            game.slots.set(i, us);
        }
        let mut kill_target: Option<u32> = None;
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive && s.role == ROLE_MAFIA {
                if let Some(t) = s.action { kill_target = Some(t); break; }
            }
        }
        let mut save_target: Option<u32> = None;
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive && s.role == ROLE_DOCTOR { save_target = s.action; break; }
        }
        let mut invest_target: Option<u32> = None;
        let mut invest_is_mafia = false;
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive && s.role == ROLE_SHERIFF {
                if let Some(t) = s.action {
                    invest_target   = Some(t);
                    invest_is_mafia = game.slots.get(t).unwrap().role == ROLE_MAFIA;
                }
                break;
            }
        }
        game.last_killed       = kill_target;
        game.last_saved        = false;
        game.last_voted_out    = None;
        game.last_investigated = invest_target;
        game.invest_is_mafia   = invest_is_mafia;
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
            s.action = None; s.submitted = false; s.commitment = None;
            game.slots.set(i, s);
        }
    }

    fn resolve_day(env: &Env, game: &mut Game) {
        let mut living = Vec::new(env);
        for i in 0..MAX_PLAYERS {
            if game.slots.get(i).unwrap().alive { living.push_back(i); }
        }
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if !s.alive || s.submitted || s.addr.is_some() { continue; }
            let action = Self::pick_excluding(env, &living, i);
            let mut us = s; us.action = action; us.submitted = true;
            game.slots.set(i, us);
        }
        let mut counts = [0u32; 8];
        for i in 0..MAX_PLAYERS {
            let s = game.slots.get(i).unwrap();
            if s.alive {
                if let Some(t) = s.action { counts[t as usize] += 1; }
            }
        }
        let mut max_v = 0u32;
        let mut elim: Option<u32> = None;
        for i in 0..8usize {
            let s = game.slots.get(i as u32).unwrap();
            if s.alive && counts[i] > max_v { max_v = counts[i]; elim = Some(i as u32); }
        }
        game.last_voted_out = elim;
        game.last_killed    = None;
        game.last_saved     = false;
        if let Some(ei) = elim {
            let mut ds = game.slots.get(ei).unwrap();
            ds.alive = false;
            game.slots.set(ei, ds);
        }
        for i in 0..MAX_PLAYERS {
            let mut s = game.slots.get(i).unwrap();
            s.action = None; s.submitted = false; s.commitment = None;
            game.slots.set(i, s);
        }
    }
}
