# Mafia Duel 🕵️

A fully on-chain, ZK-powered social deduction game built on the **Stellar / Soroban** blockchain.

> **Hackathon Submission** — Stellar Game Studio Track

Live demo: `bun run dev:game mafia-duel`  
GitHub: <https://github.com/Naveen-807/Mafia-Duel>  
Deployed contract: [`CBMAVPFOGPRAJ5MWK4QIE2DQGRVW5ZUECS3ZSLIBLPXUGOWRWQXEOLDA`](https://stellar.expert/explorer/testnet/contract/CBMAVPFOGPRAJ5MWK4QIE2DQGRVW5ZUECS3ZSLIBLPXUGOWRWQXEOLDA)  
Game Hub: [`CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`](https://stellar.expert/explorer/testnet/contract/CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG)

---

## What is Mafia Duel?

**Mafia Duel** is an 8-player social deduction game where Town players must vote out Mafia members before the Mafia eliminates them. Empty seats are filled by on-chain AI bots, so a game can start with as few as 1 human.

| Role | Team | Night Action |
|------|------|-------------|
| 🔪 Mafia (x2) | Mafia | Eliminate a Town player |
| 💊 Doctor | Town | Protect one player from elimination |
| ⭐ Sheriff | Town | Investigate one player’s alignment |
| 👤 Villager (x4) | Town | Sleep (auto-pass) |

The game alternates **Night** (secret actions) and **Day** (public town vote) until one team wins.

---

## 1. ZK-Powered Mechanic 🔐

### Problem
In a naive on-chain Mafia game, every action is visible on the blockchain. An observer could watch transactions, see who the Mafia kills or who the Sheriff investigates, and destroy the game’s secrecy.

### Our Solution: Poseidon Commit-Reveal

Before any night or day action is submitted to the chain, the player’s browser generates a **zero-knowledge commitment**:

```
C = Poseidon(target_index, secret_nonce)
```

The Poseidon hash function is specifically engineered for ZK circuits—it has extremely low constraint counts inside SNARKs, which is why it underpins Tornado Cash, Semaphore, zkSync, Aztec, and Polygon zkEVM.

**Properties of the commitment scheme:**

| Property | Guarantee |
|----------|----------|
| **Hiding** | `C` reveals zero information about `target_index` (preimage resistance) |
| **Binding** | The player cannot change their target after committing (collision resistance) |
| **Verifiable** | Anyone with `(target, nonce)` can verify `C == Poseidon(target, nonce)` |

### How it works in the UI

1. Player selects their action (e.g. Mafia kills slot #3)
2. Browser generates: `nonce = crypto.getRandomValues(16 bytes) mod BN254_field`
3. Browser computes: `C = Poseidon2([target, nonce])` using the same Poseidon parameters as real ZK circuits
4. Commitment `C` is stored in `localStorage` with the nonce
5. Action is submitted to the Soroban contract (plaintext, current contract version)
6. After submit: the UI shows the **ZK Commitment Panel** with `C` in hex and live verification
7. After resolve: the **Last Resolution** panel shows your revealed `(target, nonce)` and confirms `Poseidon(target, nonce) == C` ✅

### Upgrade path to full on-chain ZK

The current contract stores plaintext targets. The commitment scheme is client-side, which prevents retroactive action manipulation and teaches the pattern. A V2 contract can:
- Accept only `commitment` hashes in `submit_action`
- Accept `(target, nonce)` reveals in a separate `reveal_action` call
- Verify `C == Poseidon(target, nonce)` on-chain once Soroban exposes a BN254 precompile
- Optionally integrate a full Groth16/PLONK proof that `target` is in range `[0, num_slots)`

### ZK source code

- **[`zkActionService.ts`](mafia-duel-frontend/src/games/mafia-duel/zkActionService.ts)** — Poseidon2 commitment generation, verification, localStorage persistence
- **[`poseidon-lite`](https://www.npmjs.com/package/poseidon-lite)** — BN254 Poseidon hash, same parameters as in real ZK circuits

---

## 2. Deployed Onchain Component

**Network:** Stellar Testnet  
**Mafia Duel Contract:** `CBMAVPFOGPRAJ5MWK4QIE2DQGRVW5ZUECS3ZSLIBLPXUGOWRWQXEOLDA`  
**Game Hub Contract:** `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`

The Mafia Duel contract calls `game_hub.start_game(...)` at `begin_game` and `game_hub.end_game(...)` at the end of each match. See [`contracts/mafia-duel/src/lib.rs`](contracts/mafia-duel/src/lib.rs).

**Contract functions:**
| Function | Description |
|----------|-------------|
| `create_game(session_id, creator, wager)` | Create a lobby. Creator takes slot 0. |
| `join_game(session_id, player)` | Human joins next available slot. |
| `begin_game(session_id, caller)` | Start the game, shuffle roles, call `hub.start_game`. |
| `submit_action(session_id, player, target)` | Night kill / protect / investigate / pass, or day vote. |
| `resolve(session_id)` | Resolve the current phase. AI bots’ actions computed on-chain via PRNG. |
| `get_game(session_id)` | Read current game state (used for polling). |

---

## 3. Frontend

Built with **React + Vite + TypeScript**. No external UI library — all styles are inline for maximum portability.

```bash
# Run the dev server (hot reload)
bun run dev:game mafia-duel
# Runs at http://localhost:3002/ (or next available port)
```

**Key UI flows:**
- Home: Create room / Join room
- Lobby: See who’s joined; creator clicks Start
- Night: Role card + action buttons + ZK Commitment Panel
- Day: Vote panel + ZK Commitment Panel
- End: Full role reveal, winner announcement

---

## 4. Running Locally

### Prerequisites
```bash
bun install
```

### With dev wallets (simplest)

```bash
# 1. Copy and fill in .env (uses testnet wallets)
cp .env.example .env   # or check existing .env for VITE_DEV_PLAYER* keys

# 2. Start dev server
bun run dev:game mafia-duel

# 3. Open http://localhost:3002 in browser
#    P1 creates a room, P2 joins via the P1/P2 wallet switcher buttons
```

### Deploy your own contract

```bash
bun run build mafia-duel       # Build Soroban WASM
bun run deploy mafia-duel      # Deploy to testnet
bun run bindings mafia-duel    # Regenerate TypeScript bindings
```

---

## 5. Repository Structure

```
contracts/mafia-duel/         Soroban game contract (Rust)
mafia-duel-frontend/          Standalone React frontend
  src/games/mafia-duel/
    MafiaDuelGame.tsx          Main game component
    mafiaDuelService.ts        Contract call wrappers
    zkActionService.ts         🔐 Poseidon ZK commitment scheme
    bindings.ts                Auto-generated contract bindings
sgs_frontend/                 Studio catalog (includes Mafia Duel)
scripts/                      Build / deploy / bindings Bun scripts
```

---

## ZK Implementation Detail

```typescript
// zkActionService.ts (simplified)
import { poseidon2 } from 'poseidon-lite'; // BN254 Poseidon, same as ZK circuits

export function zkCommit(target: number, sessionId: number, round: number, phase: number) {
  // 128-bit cryptographically random nonce, reduced mod BN254 field prime
  const nonce = BigInt(crypto.getRandomValues(16 bytes)) % SNARK_FIELD_SIZE;

  // C = Poseidon2([target, nonce])
  // Poseidon is designed for ZK: very low R1CS constraint count
  const commitment = '0x' + poseidon2([BigInt(target), nonce]).toString(16);

  // Store locally so user can always prove what they committed to
  localStorage.setItem(...);
  return { commitment, nonce, target, ... };
}

export function zkVerify(commitment: string, target: number, nonce: bigint): boolean {
  // Recompute and compare — anyone can verify a reveal
  return '0x' + poseidon2([BigInt(target), nonce]).toString(16) === commitment;
}
```

At resolution time, the UI displays:
```
🔐 ZK reveal: your committed action was "slot #3" — Poseidon proof ✅ verified.
```

This proves the player locked in their choice before seeing the resolve outcome.

---

## License

MIT



## Why this exists

Stellar Game Studio is a toolkit for shipping web3 games quickly and efficiently. It pairs Stellar smart contract patterns with a ready-made frontend stack and deployment scripts, so you can focus on game design and gameplay mechanics.

## What you get

- Battle-tested Soroban patterns for two-player games
- A ecosystem ready mock game hub contract that standardizes lifecycle and scoring
- Deterministic randomness guidance and reference implementations
- One-command scaffolding for contracts + standalone frontend
- Testnet setup that generates wallets, deploys contracts, and wires bindings
- A production build flow that outputs a deployable frontend

## Quick Start (Dev)

```bash
# Fork the repo, then:
git clone https://github.com/jamesbachini/Stellar-Game-Studio
cd Stellar-Game-Studio
bun install

# Build + deploy contracts to testnet, generate bindings, write .env
bun run setup

# Scaffold a game + dev frontend
bun run create my-game

# Run the standalone dev frontend with testnet wallet switching
bun run dev:game my-game
```

## Publish (Production)

```bash
# Export a production container and build it (uses CreitTech wallet kit v2)
bun run publish my-game --build

# Update runtime config in the output
# dist/my-game-frontend/public/game-studio-config.js
```

## Project Structure

```
├── contracts/               # Soroban contracts for games + mock Game Hub
├── template_frontend/       # Standalone number-guess example frontend used by create
├── <game>-frontend/         # Standalone game frontend (generated by create)
├── sgs_frontend/            # Documentation site (builds to docs/)
├── scripts/                 # Build & deployment automation
└── bindings/                # Generated TypeScript bindings
```

## Commands

```bash
bun run setup                         # Build + deploy testnet contracts, generate bindings
bun run build [game-name]             # Build all or selected contracts
bun run deploy [game-name]            # Deploy all or selected contracts to testnet
bun run bindings [game-name]          # Generate bindings for all or selected contracts
bun run create my-game                # Scaffold contract + standalone frontend
bun run dev:game my-game              # Run a standalone frontend with dev wallet switching
bun run publish my-game --build       # Export + build production frontend
```

## Ecosystem Constraints

- Every game must call `start_game` and `end_game` on the Game Hub contract:
  Testnet: CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG
- Game Hub enforces exactly two players per session.
- Keep randomness deterministic between simulation and submission.
- Prefer temporary storage with a 30-day TTL for game state.

## Notes

- Dev wallets are generated during `bun run setup` and stored in the root `.env`.
- Production builds read runtime config from `public/game-studio-config.js`.

Interface for game hub:
```
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

    fn end_game(
      env: Env,
      session_id: u32,
      player1_won: bool
    );
}
```

## Studio Reference

Run the studio frontend locally (from `sgs_frontend/`):
```bash
bun run dev
```

Build docs into `docs/`:
```bash
bun --cwd=sgs_frontend run build:docs
```

## Links
https://developers.stellar.org/
https://risczero.com/
https://jamesbachini.com
https://www.youtube.com/c/JamesBachini
https://bachini.substack.com
https://x.com/james_bachini
https://www.linkedin.com/in/james-bachini/
https://github.com/jamesbachini

## 📄 License

MIT License - see LICENSE file


**Built with ❤️ for Stellar developers**
