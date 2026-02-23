# Mafia Duel — Soroban Contract

An 8-player social deduction game on Stellar Testnet.

**Contract:** `CBMAVPFOGPRAJ5MWK4QIE2DQGRVW5ZUECS3ZSLIBLPXUGOWRWQXEOLDA`
**Game Hub:** `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`

## Roles

| Role | Value | Count | Night Action |
|------|-------|-------|-------------|
| Mafia | 0 | 2 | Kill a Town player |
| Villager | 1 | 4 | Auto-pass (client-side) |
| Doctor | 2 | 1 | Protect a player |
| Sheriff | 3 | 1 | Investigate |

## Phases

Lobby (0) → Night (1) → Day (2) ↻ ... → Over (3)

## Functions

| Function | Description |
|----------|-------------|
| `create_game(session_id, creator, wager)` | Create lobby |
| `join_game(session_id, player)` | Join next AI slot |
| `begin_game(session_id, caller)` | Start; shuffle roles; call hub.start_game |
| `submit_action(session_id, player, target)` | Night/day action; `u32::MAX` = pass |
| `resolve(session_id)` | Advance phase; AI bots via PRNG; calls hub.end_game at end |
| `get_game(session_id)` | Read state (simulation) |

## Error Codes

`#3` AlreadyJoined | `#4` NotInGame | `#5` WrongPhase | `#6` AlreadyActed |
`#9` GameAlreadyOver | `#10` NotCreator | `#11` SessionExists

## Build & Deploy

```bash
bun run build mafia-duel
bun run deploy mafia-duel
bun run bindings mafia-duel
```
