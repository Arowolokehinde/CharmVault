// Charms Protocol Type Definitions

export interface UTXO {
  txid: string
  vout: number
  value: number
  scriptPubKey: string
  address?: string
}

export interface WalletState {
  connected: boolean
  address: string
  publicKey: string
  balance: number
  utxos: UTXO[]
}

export interface Beneficiary {
  address: string
  percentage: number
}

export interface InheritanceContent {
  owner_pubkey: string
  last_checkin_block: number
  trigger_delay_blocks: number
  beneficiaries: Beneficiary[]
  status: InheritanceStatus
}

export enum InheritanceStatus {
  Active = 'Active',
  Triggered = 'Triggered',
  Distributed = 'Distributed',
}

// Spell JSON Structure (Version 8)
export interface SpellJSON {
  version: 8
  apps: {
    [key: string]: string // e.g., "$00": "n/<app_id>/<app_vk>"
  }
  ins: SpellInput[]
  outs: SpellOutput[]
  private_inputs?: {
    [key: string]: any
  }
}

export interface SpellInput {
  utxo_id: string // Format: "txid:vout"
  charms?: {
    [key: string]: any // e.g., "$00": InheritanceContent
  }
}

export interface SpellOutput {
  address: string
  sats: number
  charms?: {
    [key: string]: any // e.g., "$00": InheritanceContent
  }
}

// Prover API Request
export interface ProverRequest {
  spell: SpellJSON
  binaries: {
    [app_vk: string]: string // Base64-encoded WASM
  }
  prev_txs: Array<{ bitcoin: string } | { cardano: string }> // Previous transactions wrapped in blockchain-specific format
  funding_utxo: string // "txid:vout"
  funding_utxo_value: number
  change_address: string
  fee_rate: number
  chain: 'bitcoin' | 'cardano' // Blockchain type
}

// Prover API Response
// Returns [commit_tx, spell_tx] as array
export type ProverResponse = [string, string]

// Vault Data Structure (for frontend state management)
export interface Vault {
  id: string // UTXO ID (txid:vout)
  type: string // "Inheritance", "Trust Fund", etc.
  status: InheritanceStatus
  lockedBTC: number
  unlockDate: string
  unlockBlock: number
  createdAt: string
  createdBlock: number
  beneficiaries: BeneficiaryWithName[]
  ownerPubkey: string
  triggerDelayBlocks: number
  transactions: VaultTransaction[]
}

export interface BeneficiaryWithName extends Beneficiary {
  name?: string
}

export interface VaultTransaction {
  txid: string
  type: 'create' | 'checkin' | 'update' | 'distribute'
  timestamp: string
  blockHeight: number
  confirmations: number
}

// Create Vault Parameters
export interface CreateVaultParams {
  amount: number // Amount to lock in the vault (in satoshis)
  fundingUTXO: UTXO
  ownerPubkey: string
  beneficiaries: Beneficiary[]
  triggerDelayBlocks: number
  changeAddress: string
  feeRate: number
}

// Update Beneficiaries Parameters
export interface UpdateBeneficiariesParams {
  vaultUTXO: UTXO
  vaultCharm: InheritanceContent
  newBeneficiaries: Beneficiary[]
  ownerPubkey: string
  currentBlock: number
  changeAddress: string
  feeRate: number
}

// Distribute Vault Parameters
export interface DistributeVaultParams {
  vaultUTXO: UTXO
  vaultCharm: InheritanceContent
  currentBlock: number
  feeRate: number
}

// Checkin Parameters
export interface CheckinParams {
  vaultUTXO: UTXO
  vaultCharm: InheritanceContent
  ownerPubkey: string
  currentBlock: number
  changeAddress: string
  feeRate: number
}

// Bitcoin Transaction
export interface BitcoinTransaction {
  txid: string
  hex: string
  confirmations: number
  blockHeight?: number
  timestamp?: number
}

// Error Types
export class CharmVaultError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'CharmVaultError'
  }
}

export class WalletError extends CharmVaultError {
  constructor(message: string, details?: any) {
    super(message, 'WALLET_ERROR', details)
    this.name = 'WalletError'
  }
}

export class ProverError extends CharmVaultError {
  constructor(message: string, details?: any) {
    super(message, 'PROVER_ERROR', details)
    this.name = 'ProverError'
  }
}

export class BitcoinError extends CharmVaultError {
  constructor(message: string, details?: any) {
    super(message, 'BITCOIN_ERROR', details)
    this.name = 'BitcoinError'
  }
}
