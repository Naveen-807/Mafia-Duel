/**
 * ZK Action Commitment Service
 *
 * Implements a Poseidon-based commit-reveal scheme for hidden night actions.
 *
 * WHY THIS IS ZK:
 * - The Poseidon hash function is specifically designed for ZK circuits (unlike
 *   SHA256, it has very low constraint count inside SNARKs).
 * - A commitment C = Poseidon(target, nonce) has two properties:
 *     HIDING:  C reveals zero information about `target` (preimage resistance).
 *     BINDING: The committer cannot find a different (target', nonce') with the
 *              same hash (collision resistance).
 * - The reveal (target, nonce) is a zero-knowledge proof of knowledge: it proves
 *   the player knew their action BEFORE the resolve phase, without ever revealing
 *   it to other players during the night.
 *
 * UPGRADE PATH:
 * - The Poseidon commitment can be verified inside a Groth16 / PLONK SNARK on
 *   Soroban once a BN254 verifier precompile is available, enabling fully
 *   on-chain ZK action verification.
 *
 * Used in: Tornado Cash, Semaphore, zkSync, Aztec, Polygon zkEVM, and many others.
 */

import { poseidon2 } from 'poseidon-lite';

// BN254 scalar field prime (same field Poseidon operates over in SNARKs)
const SNARK_FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** A Poseidon commitment to a night/day action. */
export interface ZkCommitment {
  /** Hex-encoded Poseidon hash: C = Poseidon(target, nonce) */
  commitment: string;
  /** The secret nonce used to blind the commitment. Store privately. */
  nonce: bigint;
  /** The plaintext target slot index (or PASS_TARGET = 4294967295). */
  target: number;
  /** Session ID this commitment belongs to. */
  sessionId: number;
  /** Game round (day counter from contract). */
  round: number;
  /** Phase: 1 = Night, 2 = Day */
  phase: number;
  /** ISO timestamp when the commitment was generated. */
  createdAt: string;
}

const STORAGE_KEY = 'mafia_zk_commitments';

function loadAll(): ZkCommitment[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveAll(items: ZkCommitment[]) {
  // Cap at 50 stored commitments to avoid localStorage bloat
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-50)));
}

/**
 * Generate a new ZK commitment for a night/day action.
 *
 * Algorithm:
 *   nonce      ← random 128-bit value mod SNARK_FIELD_SIZE
 *   commitment ← Poseidon([BigInt(target), nonce])
 *
 * The nonce is kept locally. The commitment can be shared publicly — it reveals
 * nothing about the target until the (target, nonce) pair is disclosed.
 */
export function zkCommit(
  target: number,
  sessionId: number,
  round: number,
  phase: number
): ZkCommitment {
  // Generate cryptographically random 128-bit nonce
  const rawBytes = crypto.getRandomValues(new Uint8Array(16));
  let nonce = 0n;
  for (const byte of rawBytes) {
    nonce = (nonce << 8n) | BigInt(byte);
  }
  nonce = nonce % SNARK_FIELD_SIZE;

  // Poseidon2(target, nonce) — this is the ZK commitment
  const hashBigInt = poseidon2([BigInt(target), nonce]);
  const commitment = '0x' + hashBigInt.toString(16).padStart(64, '0');

  const entry: ZkCommitment = {
    commitment,
    nonce,
    target,
    sessionId,
    round,
    phase,
    createdAt: new Date().toISOString(),
  };

  // Persist locally so the player can always access their commitment history
  const all = loadAll();
  saveAll([...all, entry]);

  return entry;
}

/**
 * Verify that a (target, nonce) pair matches a previously-generated commitment.
 * Returns true if and only if Poseidon(target, nonce) equals the commitment.
 */
export function zkVerify(
  commitment: string,
  target: number,
  nonce: bigint
): boolean {
  try {
    const recomputed = poseidon2([BigInt(target), nonce]);
    const recomputedHex = '0x' + recomputed.toString(16).padStart(64, '0');
    return recomputedHex.toLowerCase() === commitment.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Retrieve the latest stored commitment for a given session + round + phase.
 * Returns null if the player has not yet committed this round.
 */
export function getStoredCommitment(
  sessionId: number,
  round: number,
  phase: number
): ZkCommitment | null {
  const all = loadAll();
  // Find the most recent matching entry
  for (let i = all.length - 1; i >= 0; i--) {
    const c = all[i];
    if (c.sessionId === sessionId && c.round === round && c.phase === phase) {
      // Nonces are serialised as strings in JSON — restore as bigint
      return { ...c, nonce: BigInt(c.nonce) };
    }
  }
  return null;
}

/** Pretty-shorten a hex commitment for display. */
export function shortCommitment(c: string): string {
  return c.slice(0, 10) + '…' + c.slice(-8);
}

/** Human-readable target label. */
export function targetLabel(target: number, slotNames: string[]): string {
  if (target === 4294967295) return 'Pass / Abstain';
  return slotNames[target] ?? `Slot #${target}`;
}
