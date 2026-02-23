import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAOLYDIRWMP45I5SEAXNDCREDXY7U3G43KEUZTFKCBBNTQ2NN3KATUUS",
  }
} as const


export interface Game {
  creator: string;
  day: u32;
  human_count: u32;
  invest_is_mafia: boolean;
  last_investigated: Option<u32>;
  last_killed: Option<u32>;
  last_saved: boolean;
  last_voted_out: Option<u32>;
  phase: u32;
  slots: Array<Slot>;
  wager: i128;
  winner: Option<u32>;
}


export interface Slot {
  action: Option<u32>;
  addr: Option<string>;
  alive: boolean;
  commitment: Option<Buffer>;
  role: u32;
  submitted: boolean;
}

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "Admin", values: void} | {tag: "GameHubAddress", values: void};

export const MafiaError = {
  1: {message:"GameNotFound"},
  2: {message:"GameFull"},
  3: {message:"AlreadyJoined"},
  4: {message:"NotInGame"},
  5: {message:"WrongPhase"},
  6: {message:"AlreadyActed"},
  7: {message:"InvalidTarget"},
  8: {message:"NotAlive"},
  9: {message:"GameAlreadyOver"},
  10: {message:"NotCreator"},
  11: {message:"SessionExists"},
  12: {message:"InvalidReveal"},
  13: {message:"NoCommitment"}
}

export interface Client {
  /**
   * Construct and simulate a get_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hub: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a resolve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Advance phase: PHASE_NIGHT_REVEAL->PHASE_DAY, PHASE_DAY->PHASE_NIGHT_COMMIT.
   */
  resolve: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_hub: ({new_hub}: {new_hub: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_game: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Game>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a join_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  join_game: ({session_id, player}: {session_id: u32, player: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a begin_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  begin_game: ({session_id, caller}: {session_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_game: ({session_id, creator, wager}: {session_id: u32, creator: string, wager: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reveal_action transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * ZK Step 2 (binding): reveal target+nonce; contract verifies sha256(target||nonce)==commitment.
   * Returns InvalidReveal (#12) on mismatch — cannot change a committed target.
   */
  reveal_action: ({session_id, player, target, nonce}: {session_id: u32, player: string, target: u32, nonce: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a submit_action transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Day vote (transparent by design — daytime discussion is public).
   */
  submit_action: ({session_id, player, target}: {session_id: u32, player: string, target: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a submit_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * ZK Step 1 (hiding): store commitment = sha256(target_be || nonce_be).
   * Auto-advances to PHASE_NIGHT_REVEAL once all alive humans commit.
   */
  submit_commitment: ({session_id, player, commitment}: {session_id: u32, player: string, commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, game_hub}: {admin: string, game_hub: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, game_hub}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAAMAAAAAAAAAAdjcmVhdG9yAAAAABMAAAAAAAAAA2RheQAAAAAEAAAAAAAAAAtodW1hbl9jb3VudAAAAAAEAAAAAAAAAA9pbnZlc3RfaXNfbWFmaWEAAAAAAQAAAAAAAAARbGFzdF9pbnZlc3RpZ2F0ZWQAAAAAAAPoAAAABAAAAAAAAAALbGFzdF9raWxsZWQAAAAD6AAAAAQAAAAAAAAACmxhc3Rfc2F2ZWQAAAAAAAEAAAAAAAAADmxhc3Rfdm90ZWRfb3V0AAAAAAPoAAAABAAAAAAAAAAFcGhhc2UAAAAAAAAEAAAAAAAAAAVzbG90cwAAAAAAA+oAAAfQAAAABFNsb3QAAAAAAAAABXdhZ2VyAAAAAAAACwAAAAAAAAAGd2lubmVyAAAAAAPoAAAABA==",
        "AAAAAQAAAAAAAAAAAAAABFNsb3QAAAAGAAAAAAAAAAZhY3Rpb24AAAAAA+gAAAAEAAAAAAAAAARhZGRyAAAD6AAAABMAAAAAAAAABWFsaXZlAAAAAAAAAQAAAAAAAAAKY29tbWl0bWVudAAAAAAD6AAAA+4AAAAgAAAAAAAAAARyb2xlAAAABAAAAAAAAAAJc3VibWl0dGVkAAAAAAAAAQ==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAOR2FtZUh1YkFkZHJlc3MAAA==",
        "AAAABAAAAAAAAAAAAAAACk1hZmlhRXJyb3IAAAAAAA0AAAAAAAAADEdhbWVOb3RGb3VuZAAAAAEAAAAAAAAACEdhbWVGdWxsAAAAAgAAAAAAAAANQWxyZWFkeUpvaW5lZAAAAAAAAAMAAAAAAAAACU5vdEluR2FtZQAAAAAAAAQAAAAAAAAACldyb25nUGhhc2UAAAAAAAUAAAAAAAAADEFscmVhZHlBY3RlZAAAAAYAAAAAAAAADUludmFsaWRUYXJnZXQAAAAAAAAHAAAAAAAAAAhOb3RBbGl2ZQAAAAgAAAAAAAAAD0dhbWVBbHJlYWR5T3ZlcgAAAAAJAAAAAAAAAApOb3RDcmVhdG9yAAAAAAAKAAAAAAAAAA1TZXNzaW9uRXhpc3RzAAAAAAAACwAAAAAAAAANSW52YWxpZFJldmVhbAAAAAAAAAwAAAAAAAAADE5vQ29tbWl0bWVudAAAAA0=",
        "AAAAAAAAAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAExBZHZhbmNlIHBoYXNlOiBQSEFTRV9OSUdIVF9SRVZFQUwtPlBIQVNFX0RBWSwgUEhBU0VfREFZLT5QSEFTRV9OSUdIVF9DT01NSVQuAAAAB3Jlc29sdmUAAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAAKTWFmaWFFcnJvcgAA",
        "AAAAAAAAAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAIZ2V0X2dhbWUAAAABAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAQAAA+gAAAfQAAAABEdhbWU=",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJam9pbl9nYW1lAAAAAAAAAgAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGcGxheWVyAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAApNYWZpYUVycm9yAAA=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAKYmVnaW5fZ2FtZQAAAAAAAgAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAApNYWZpYUVycm9yAAA=",
        "AAAAAAAAAAAAAAALY3JlYXRlX2dhbWUAAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAV3YWdlcgAAAAAAAAsAAAABAAAD6QAAAAIAAAfQAAAACk1hZmlhRXJyb3IAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZ2FtZV9odWIAAAATAAAAAA==",
        "AAAAAAAAAKxaSyBTdGVwIDIgKGJpbmRpbmcpOiByZXZlYWwgdGFyZ2V0K25vbmNlOyBjb250cmFjdCB2ZXJpZmllcyBzaGEyNTYodGFyZ2V0fHxub25jZSk9PWNvbW1pdG1lbnQuClJldHVybnMgSW52YWxpZFJldmVhbCAoIzEyKSBvbiBtaXNtYXRjaCDigJQgY2Fubm90IGNoYW5nZSBhIGNvbW1pdHRlZCB0YXJnZXQuAAAADXJldmVhbF9hY3Rpb24AAAAAAAAEAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAABnRhcmdldAAAAAAABAAAAAAAAAAFbm9uY2UAAAAAAAAGAAAAAQAAA+kAAAACAAAH0AAAAApNYWZpYUVycm9yAAA=",
        "AAAAAAAAAEJEYXkgdm90ZSAodHJhbnNwYXJlbnQgYnkgZGVzaWduIOKAlCBkYXl0aW1lIGRpc2N1c3Npb24gaXMgcHVibGljKS4AAAAAAA1zdWJtaXRfYWN0aW9uAAAAAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAZ0YXJnZXQAAAAAAAQAAAABAAAD6QAAAAIAAAfQAAAACk1hZmlhRXJyb3IAAA==",
        "AAAAAAAAAIdaSyBTdGVwIDEgKGhpZGluZyk6IHN0b3JlIGNvbW1pdG1lbnQgPSBzaGEyNTYodGFyZ2V0X2JlIHx8IG5vbmNlX2JlKS4KQXV0by1hZHZhbmNlcyB0byBQSEFTRV9OSUdIVF9SRVZFQUwgb25jZSBhbGwgYWxpdmUgaHVtYW5zIGNvbW1pdC4AAAAAEXN1Ym1pdF9jb21taXRtZW50AAAAAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAApjb21taXRtZW50AAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAB9AAAAAKTWFmaWFFcnJvcgAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_hub: this.txFromJSON<string>,
        resolve: this.txFromJSON<Result<void>>,
        set_hub: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_game: this.txFromJSON<Option<Game>>,
        get_admin: this.txFromJSON<string>,
        join_game: this.txFromJSON<Result<void>>,
        set_admin: this.txFromJSON<null>,
        begin_game: this.txFromJSON<Result<void>>,
        create_game: this.txFromJSON<Result<void>>,
        reveal_action: this.txFromJSON<Result<void>>,
        submit_action: this.txFromJSON<Result<void>>,
        submit_commitment: this.txFromJSON<Result<void>>
  }
}