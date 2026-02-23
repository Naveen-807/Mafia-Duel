import { Client as MafiaDuelClient, type Game } from './bindings';
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  DEFAULT_METHOD_OPTIONS,
} from '@/utils/constants';
import type { ContractSigner } from '@/types/signer';
import { contract } from '@stellar/stellar-sdk';
import { signAndSendViaLaunchtube } from '@/utils/transactionHelper';

type ClientOptions = contract.ClientOptions;

// Pass this as `target` when the role has no night action (Villager) or you abstain (Day)
export const PASS_TARGET = 4294967295; // u32::MAX

export class MafiaDuelService {
  private baseClient: MafiaDuelClient;
  private contractId: string;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.baseClient = new MafiaDuelClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    });
  }

  private createSigningClient(
    publicKey: string,
    signer: ContractSigner
  ): MafiaDuelClient {
    return new MafiaDuelClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey,
      signTransaction: signer.signTransaction as ClientOptions['signTransaction'],
      signAuthEntry: signer.signAuthEntry as ClientOptions['signAuthEntry'],
    });
  }

  /** Read the current game state. Returns null if not found. */
  async getGame(sessionId: number): Promise<Game | null> {
    try {
      const tx = await this.baseClient.get_game({ session_id: sessionId });
      const sim = await tx.simulate();
      const val = sim.result;
      if (val === undefined || val === null) return null;
      return val as unknown as Game;
    } catch {
      return null;
    }
  }

  /**
   * Create a new 8-player room.
   * Creator occupies slot 0; remaining 7 start as AI.
   */
  async createGame(
    sessionId: number,
    creator: string,
    wager: bigint,
    signer: ContractSigner
  ): Promise<void> {
    const client = this.createSigningClient(creator, signer);
    const tx = await client.create_game(
      { session_id: sessionId, creator, wager },
      DEFAULT_METHOD_OPTIONS
    );
    await signAndSendViaLaunchtube(tx);
  }

  /**
   * Join an existing lobby. Replaces the next AI slot with this human.
   */
  async joinGame(
    sessionId: number,
    player: string,
    signer: ContractSigner
  ): Promise<void> {
    const client = this.createSigningClient(player, signer);
    const tx = await client.join_game(
      { session_id: sessionId, player },
      DEFAULT_METHOD_OPTIONS
    );
    await signAndSendViaLaunchtube(tx);
  }

  /**
   * Creator begins the game: shuffles roles, enters night phase 1.
   * Calls Game Hub start_game internally.
   */
  async beginGame(
    sessionId: number,
    caller: string,
    signer: ContractSigner
  ): Promise<void> {
    const client = this.createSigningClient(caller, signer);
    const tx = await client.begin_game(
      { session_id: sessionId, caller },
      DEFAULT_METHOD_OPTIONS
    );
    await signAndSendViaLaunchtube(tx);
  }

  /**
   * Submit a night or day action.
   * Night: Mafia→kill, Doctor→protect, Sheriff→investigate, Villager→PASS_TARGET
   * Day:   Vote→slot index, Abstain→PASS_TARGET
   */
  async submitAction(
    sessionId: number,
    player: string,
    target: number,
    signer: ContractSigner
  ): Promise<void> {
    const client = this.createSigningClient(player, signer);
    const tx = await client.submit_action(
      { session_id: sessionId, player, target },
      DEFAULT_METHOD_OPTIONS
    );
    await signAndSendViaLaunchtube(tx);
  }

  /**
   * Resolve the current phase. Anyone (any human or even a bot) can call.
   * AI slots get PRNG actions computed on-chain; unsubmitted humans are treated as pass.
   */
  async resolve(
    sessionId: number,
    caller: string,
    signer: ContractSigner
  ): Promise<void> {
    const client = this.createSigningClient(caller, signer);
    const tx = await client.resolve(
      { session_id: sessionId },
      DEFAULT_METHOD_OPTIONS
    );
    await signAndSendViaLaunchtube(tx);
  }
}
