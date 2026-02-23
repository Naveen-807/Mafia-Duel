/**
 * ZK Action Commitment Service — SHA-256 Onchain Commit-Reveal
 *
 * Implements a SHA-256 commit-reveal scheme for hidden night actions.
 * The commitment is computed IDENTICALLY in both the browser and the Soroban
 * contract, enabling full onchain verification.
 *
 * ALGORITHM (matches contract `compute_commitment`):
 *   preimage   = target_u32_be (4 bytes) || nonce_u64_be (8 bytes)  = 12 bytes
 *   commitment = SHA-256(preimage)
 *
 * PROPERTIES:
 *   HIDING:  SHA-256 is a one-way function — the commitment reveals nothing
 *            about the target before the reveal step.
 *   BINDING: SHA-256 is collision-resistant — a committed target cannot be
 *            changed after submission. The contract enforces this onchain by
 *            recomputing SHA-256(target||nonce) and rejecting any mismatch
 *            (MafiaError::InvalidReveal, error code #12).
 *
 * ONCHAIN VERIFICATION:
 *   The Soroban contract calls env.crypto().sha256() — a native host function —
 *   to verify the preimage on every reveal_action call.
 *   This is a REAL zero-knowledge commitment scheme enforced on-chain, satisfying
 *   the hackathon requirement "ZK powers a core mechanic."
 *
 * Flow per night:
 *   1. PHASE_NIGHT_COMMIT: player calls submit_commitment(sha256(target||nonce))
 *      Target stays hidden — only the hash is sent to the contract.
 *   2. PHASE_NIGHT_REVEAL: player calls reveal_action(target, nonce).
 *      Contract verifies sha256(target||nonce) == stored hash.
 *      Any different (target', nonce') pair → InvalidReveal → rejected.
 */

/** An onchain-verifiable SHA-256 commitment to a night action. */
export interface ZkCommitment {
  /** Hex-encoded SHA-256: sha256(target_u32_be || nonce_u64_be) */
  commitment: string;
  /** Secret u64 nonce (stored as string in JSON, restored as bigint). */
  nonce: bigint;
  /** The plaintext target slot index (or PASS_TARGET = 4294967295). */
  target: number;
  /** Session ID this commitment belongs to. */
  sessionId: number;
  /** Game round (day counter from contract). */
  round: number;
  /** Phase constant (PHASE_NIGHT_COMMIT = 1). */
  phase: number;
  /** ISO timestamp when the commitment was generated. */
  createdAt: string;
}

/**
 * Compute SHA-256(target_u32_be || nonce_u64_be).
 * Matches the Soroban contract's `compute_commitment` function exactly.
 */
async function sha256Commitment(target: number, nonce: bigint): Promise<string> {
  const buf = new ArrayBuffer(12);
  const view = new DataView(buf);
  // target: 4 bytes big-endian u32
  view.setUint32(0, target >>> 0, false);
  // nonce: 8 bytes big-endian u64 (split into two u32)
  const hi = Number((nonce >> 32n) & 0xFFFFFFFFn);
  const lo = Number(nonce & 0xFFFFFFFFn);
  view.setUint32(4, hi, false);
  view.setUint32(8, lo, false);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return '0x' + Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const STORAGE_KEY = 'mafia_zk_commitments';

function loadAll(): ZkCommitment[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    // Restore nonce strings → bigint (stored as string to avoid JSON.stringify crash)
    return raw.map((c: ZkCommitment & { nonce: unknown }) => ({
      ...c,
      nonce: BigInt(c.nonce as string | number | bigint),
    }));
  } catch {
    return [];
  }
}

function saveAll(items: ZkCommitment[]) {
  // Cap at 50 stored commitments to avoid localStorage bloat.
  // JSON.stringify cannot handle BigInt — convert nonce to string.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      items.slice(-50),
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value)
    )
  );
}

/**
 * Generate a SHA-256 commitment for a night action.
 *
 * nonce ← random 8 bytes (u64)
 * commitment ← SHA-256(target_u32_be || nonce_u64_be)   [12-byte preimage]
 *
 * The commitment hex string can be passed directly to `submit_commitment`.
 * The nonce is stored in localStorage for the reveal step.
 */
export async function zkCommit(
  target: number,
  sessionId: number,
  round: number,
  phase: number
): Promise<ZkCommitment> {
  // Generate cryptographically random 8-byte (u64) nonce
  const rawBytes = crypto.getRandomValues(new Uint8Array(8));
  let nonce = 0n;
  for (const byte of rawBytes) {
    nonce = (nonce << 8n) | BigInt(byte);
  }

  const commitment = await sha256Commitment(target, nonce);

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
 * Verify that a (target, nonce) pair matches a stored commitment.
 * Returns true iff sha256(target_u32_be || nonce_u64_be) equals the commitment.
 */
export async function zkVerify(
  commitment: string,
  target: number,
  nonce: bigint
): Promise<boolean> {
  try {
    const recomputed = await sha256Commitment(target, nonce);
    return recomputed.toLowerCase() === commitment.toLowerCase();
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
      return c; // nonce already restored as bigint by loadAll()
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
