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
    contractId: "CBMAVPFOGPRAJ5MWK4QIE2DQGRVW5ZUECS3ZSLIBLPXUGOWRWQXEOLDA",
  }
} as const


/**
 * Full game state.
 */
export interface Game {
  creator: string;
  /**
 * Increments each time a day phase resolves
 */
day: u32;
  /**
 * Number of human players currently in the room (1-8)
 */
human_count: u32;
  invest_is_mafia: boolean;
  last_investigated: Option<u32>;
  last_killed: Option<u32>;
  last_saved: boolean;
  last_voted_out: Option<u32>;
  phase: u32;
  slots: Array<Slot>;
  /**
 * Points wagered (informational)
 */
wager: i128;
  /**
 * TEAM_MAFIA or TEAM_TOWN once game ends
 */
winner: Option<u32>;
}


/**
 * One player slot (human or AI).
 */
export interface Slot {
  /**
 * Night target or day vote target index; None = pass/abstain
 */
action: Option<u32>;
  /**
 * None = AI-controlled slot
 */
addr: Option<string>;
  alive: boolean;
  role: u32;
  /**
 * Has this slot submitted an action this phase?
 */
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
  11: {message:"SessionExists"}
}

export interface Client {
  /**
   * Construct and simulate a get_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hub: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a resolve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolve the current phase. Anyone can call.
   * AI slots get PRNG-computed actions; human non-submitters are treated as pass.
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
   * Get full game state. Frontend shows only YOUR role during active play.
   */
  get_game: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Game>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a join_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Join an existing lobby. Fills the next open AI slot with this human.
   */
  join_game: ({session_id, player}: {session_id: u32, player: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a begin_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creator starts the game: shuffles roles onto all 8 slots, enters night 1.
   */
  begin_game: ({session_id, caller}: {session_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new 8-player room. Creator occupies slot 0; remaining 7 are AI.
   */
  create_game: ({session_id, creator, wager}: {session_id: u32, creator: string, wager: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a submit_action transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit an action for the current phase.
   * 
   * Night: Mafia -> kill target idx | Doctor -> protect target idx
   * Sheriff -> investigate target idx | Villager -> pass (u32::MAX)
   * Day:   Vote -> target idx | Abstain -> u32::MAX
   */
  submit_action: ({session_id, player, target}: {session_id: u32, player: string, target: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAQAAABBGdWxsIGdhbWUgc3RhdGUuAAAAAAAAAARHYW1lAAAADAAAAAAAAAAHY3JlYXRvcgAAAAATAAAAKUluY3JlbWVudHMgZWFjaCB0aW1lIGEgZGF5IHBoYXNlIHJlc29sdmVzAAAAAAAAA2RheQAAAAAEAAAAM051bWJlciBvZiBodW1hbiBwbGF5ZXJzIGN1cnJlbnRseSBpbiB0aGUgcm9vbSAoMS04KQAAAAALaHVtYW5fY291bnQAAAAABAAAAAAAAAAPaW52ZXN0X2lzX21hZmlhAAAAAAEAAAAAAAAAEWxhc3RfaW52ZXN0aWdhdGVkAAAAAAAD6AAAAAQAAAAAAAAAC2xhc3Rfa2lsbGVkAAAAA+gAAAAEAAAAAAAAAApsYXN0X3NhdmVkAAAAAAABAAAAAAAAAA5sYXN0X3ZvdGVkX291dAAAAAAD6AAAAAQAAAAAAAAABXBoYXNlAAAAAAAABAAAAAAAAAAFc2xvdHMAAAAAAAPqAAAH0AAAAARTbG90AAAAHlBvaW50cyB3YWdlcmVkIChpbmZvcm1hdGlvbmFsKQAAAAAABXdhZ2VyAAAAAAAACwAAACZURUFNX01BRklBIG9yIFRFQU1fVE9XTiBvbmNlIGdhbWUgZW5kcwAAAAAABndpbm5lcgAAAAAD6AAAAAQ=",
        "AAAAAQAAAB5PbmUgcGxheWVyIHNsb3QgKGh1bWFuIG9yIEFJKS4AAAAAAAAAAAAEU2xvdAAAAAUAAAA6TmlnaHQgdGFyZ2V0IG9yIGRheSB2b3RlIHRhcmdldCBpbmRleDsgTm9uZSA9IHBhc3MvYWJzdGFpbgAAAAAABmFjdGlvbgAAAAAD6AAAAAQAAAAZTm9uZSA9IEFJLWNvbnRyb2xsZWQgc2xvdAAAAAAAAARhZGRyAAAD6AAAABMAAAAAAAAABWFsaXZlAAAAAAAAAQAAAAAAAAAEcm9sZQAAAAQAAAAtSGFzIHRoaXMgc2xvdCBzdWJtaXR0ZWQgYW4gYWN0aW9uIHRoaXMgcGhhc2U/AAAAAAAACXN1Ym1pdHRlZAAAAAAAAAE=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAOR2FtZUh1YkFkZHJlc3MAAA==",
        "AAAABAAAAAAAAAAAAAAACk1hZmlhRXJyb3IAAAAAAAsAAAAAAAAADEdhbWVOb3RGb3VuZAAAAAEAAAAAAAAACEdhbWVGdWxsAAAAAgAAAAAAAAANQWxyZWFkeUpvaW5lZAAAAAAAAAMAAAAAAAAACU5vdEluR2FtZQAAAAAAAAQAAAAAAAAACldyb25nUGhhc2UAAAAAAAUAAAAAAAAADEFscmVhZHlBY3RlZAAAAAYAAAAAAAAADUludmFsaWRUYXJnZXQAAAAAAAAHAAAAAAAAAAhOb3RBbGl2ZQAAAAgAAAAAAAAAD0dhbWVBbHJlYWR5T3ZlcgAAAAAJAAAAAAAAAApOb3RDcmVhdG9yAAAAAAAKAAAAAAAAAA1TZXNzaW9uRXhpc3RzAAAAAAAACw==",
        "AAAAAAAAAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAHlSZXNvbHZlIHRoZSBjdXJyZW50IHBoYXNlLiBBbnlvbmUgY2FuIGNhbGwuCkFJIHNsb3RzIGdldCBQUk5HLWNvbXB1dGVkIGFjdGlvbnM7IGh1bWFuIG5vbi1zdWJtaXR0ZXJzIGFyZSB0cmVhdGVkIGFzIHBhc3MuAAAAAAAAB3Jlc29sdmUAAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAAKTWFmaWFFcnJvcgAA",
        "AAAAAAAAAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAEZHZXQgZnVsbCBnYW1lIHN0YXRlLiBGcm9udGVuZCBzaG93cyBvbmx5IFlPVVIgcm9sZSBkdXJpbmcgYWN0aXZlIHBsYXkuAAAAAAAIZ2V0X2dhbWUAAAABAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAQAAA+gAAAfQAAAABEdhbWU=",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAERKb2luIGFuIGV4aXN0aW5nIGxvYmJ5LiBGaWxscyB0aGUgbmV4dCBvcGVuIEFJIHNsb3Qgd2l0aCB0aGlzIGh1bWFuLgAAAAlqb2luX2dhbWUAAAAAAAACAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAABAAAD6QAAAAIAAAfQAAAACk1hZmlhRXJyb3IAAA==",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAElDcmVhdG9yIHN0YXJ0cyB0aGUgZ2FtZTogc2h1ZmZsZXMgcm9sZXMgb250byBhbGwgOCBzbG90cywgZW50ZXJzIG5pZ2h0IDEuAAAAAAAACmJlZ2luX2dhbWUAAAAAAAIAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAKTWFmaWFFcnJvcgAA",
        "AAAAAAAAAEhDcmVhdGUgYSBuZXcgOC1wbGF5ZXIgcm9vbS4gQ3JlYXRvciBvY2N1cGllcyBzbG90IDA7IHJlbWFpbmluZyA3IGFyZSBBSS4AAAALY3JlYXRlX2dhbWUAAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAV3YWdlcgAAAAAAAAsAAAABAAAD6QAAAAIAAAfQAAAACk1hZmlhRXJyb3IAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZ2FtZV9odWIAAAATAAAAAA==",
        "AAAAAAAAANdTdWJtaXQgYW4gYWN0aW9uIGZvciB0aGUgY3VycmVudCBwaGFzZS4KCk5pZ2h0OiBNYWZpYSAtPiBraWxsIHRhcmdldCBpZHggfCBEb2N0b3IgLT4gcHJvdGVjdCB0YXJnZXQgaWR4ClNoZXJpZmYgLT4gaW52ZXN0aWdhdGUgdGFyZ2V0IGlkeCB8IFZpbGxhZ2VyIC0+IHBhc3MgKHUzMjo6TUFYKQpEYXk6ICAgVm90ZSAtPiB0YXJnZXQgaWR4IHwgQWJzdGFpbiAtPiB1MzI6Ok1BWAAAAAANc3VibWl0X2FjdGlvbgAAAAAAAAMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABnBsYXllcgAAAAAAEwAAAAAAAAAGdGFyZ2V0AAAAAAAEAAAAAQAAA+kAAAACAAAH0AAAAApNYWZpYUVycm9yAAA=" ]),
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
        submit_action: this.txFromJSON<Result<void>>
  }
}