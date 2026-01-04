import {
  Vault,
  Beneficiary,
  InheritanceContent,
  InheritanceStatus,
  UTXO,
  CreateVaultParams,
  CharmVaultError,
  WalletState,
} from '../../types/charms'
import { leatherWallet } from '../wallet/leatherWallet'
import { unisatWallet } from '../wallet/unisatWallet'
import { bitcoinClient } from '../bitcoin/bitcoinClient'
import { proverClient } from './proverClient'
import { spellBuilder } from './spellBuilder'
import { convertRawTxToPsbt, extractTxFromPsbt } from '../bitcoin/psbtHelper'
import { utxoLockService } from '../utxoLockService'

class VaultService {
  private vaultsCache: Map<string, Vault> = new Map()
  private failedUTXOs: Map<string, { count: number; lastFailed: number }> = new Map()

  /**
   * Get the active wallet service (either Unisat or Leather)
   */
  private getActiveWallet(): { state: WalletState; signTransaction: (txHex: string) => Promise<string> } | null {
    const leatherState = leatherWallet.getWalletState()
    if (leatherState) {
      return {
        state: leatherState,
        signTransaction: (txHex: string) => leatherWallet.signTransaction(txHex)
      }
    }

    const unisatState = unisatWallet.getWalletState()
    if (unisatState) {
      return {
        state: unisatState,
        signTransaction: (txHex: string) => unisatWallet.signTransaction(txHex)
      }
    }

    return null
  }

  /**
   * Create a new vault
   */
  async createVault(
    amount: number,
    beneficiaries: Beneficiary[],
    triggerDelayBlocks: number
  ): Promise<string> {
    let fundingUTXO: UTXO | null = null // Declare outside try to access in catch

    try {
      // Validate beneficiaries
      if (!spellBuilder.validateBeneficiaries(beneficiaries)) {
        throw new CharmVaultError(
          'Beneficiary percentages must sum to exactly 100%',
          'VALIDATION_ERROR'
        )
      }

      // Get active wallet
      const activeWallet = this.getActiveWallet()
      if (!activeWallet) {
        throw new CharmVaultError('Wallet not connected', 'WALLET_NOT_CONNECTED')
      }
      const walletState = activeWallet.state

      // Find suitable UTXO for funding
      fundingUTXO = this.selectFundingUTXO(walletState.utxos, amount)
      if (!fundingUTXO) {
        throw new CharmVaultError(
          'Insufficient funds or all suitable UTXOs are currently locked/cooling down. Please try again in a few minutes.',
          'INSUFFICIENT_FUNDS'
        )
      }

      // Validate UTXO has enough value to cover fees (2000 sats minimum)
      const MIN_UTXO_VALUE = 3000 // 2000 for fees + 1000 minimum vault value
      if (fundingUTXO.value < MIN_UTXO_VALUE) {
        throw new CharmVaultError(
          `Funding UTXO too small (${fundingUTXO.value} sats). Need at least ${MIN_UTXO_VALUE} sats for Charms transaction fees.`,
          'INSUFFICIENT_FUNDS'
        )
      }

      // LOCK UTXO immediately to prevent double spending
      const utxoId = `${fundingUTXO.txid}:${fundingUTXO.vout}`
      utxoLockService.lockUTXO(utxoId, 'creating_vault')
      console.log(`🔒 Locked UTXO ${utxoId} for vault creation`)

      try {
        // Get current block height
        const currentBlock = await bitcoinClient.getCurrentBlockHeight()

        // Get fee estimate
        const feeEstimates = await bitcoinClient.getFeeEstimates()
        const feeRate = feeEstimates.halfHourFee || 2.0

        // Build create vault parameters
        const params: CreateVaultParams = {
          amount, // Amount to lock in vault
          fundingUTXO,
          ownerPubkey: walletState.publicKey,
          beneficiaries,
          triggerDelayBlocks,
          changeAddress: walletState.address,
          feeRate,
        }

      // Debug logging
      console.log('Wallet state:', {
        address: walletState.address,
        publicKey: walletState.publicKey,
        balance: walletState.balance,
        utxoCount: walletState.utxos.length
      })
      console.log('Create vault params:', {
        fundingUTXO,
        ownerPubkey: walletState.publicKey,
        beneficiaries,
        triggerDelayBlocks,
        changeAddress: walletState.address,
        feeRate
      })

      // Build spell
      console.log('Building create vault spell...')
      const spell = await spellBuilder.buildCreateVaultSpell(params)

      // Fetch previous transaction
      // prev_txs must contain transactions that CREATE the UTXOs referenced in spell's ins
      const prevTxHex = await bitcoinClient.getRawTransaction(fundingUTXO.txid)

      // Build prover request
      console.log('Building prover request...')
      const proverRequest = await proverClient.buildProverRequest(
        spell,
        [prevTxHex],  // Transaction creating the funding UTXO (required by Prover API)
        `${fundingUTXO.txid}:${fundingUTXO.vout}`,
        fundingUTXO.value,
        walletState.address,
        feeRate
      )

      // Send to prover API (this takes ~5 minutes)
      console.log('Generating ZK proof (this may take several minutes)...')
      const proverResponse = await proverClient.proveSpell(proverRequest)

      // Extract transactions from prover response
      const [commitTx, spellTxOriginal] = proverResponse
      let spellTx = spellTxOriginal

      // Debug: Parse and log transaction structure
      console.log('=== TRANSACTION ANALYSIS ===')
      const bitcoin = await import('bitcoinjs-lib')
      const { Buffer } = await import('buffer')

      const commitTxParsed = bitcoin.Transaction.fromHex(commitTx)
      let spellTxParsed = bitcoin.Transaction.fromHex(spellTx)

      console.log('Commit TX inputs:', commitTxParsed.ins.length)
      commitTxParsed.ins.forEach((input, i) => {
        const txid = Buffer.from(input.hash).reverse().toString('hex')
        console.log(`  Input ${i}: ${txid}:${input.index}`)
      })

      console.log('Spell TX inputs (BEFORE fix):', spellTxParsed.ins.length)
      spellTxParsed.ins.forEach((input, i) => {
        const txid = Buffer.from(input.hash).reverse().toString('hex')
        console.log(`  Input ${i}: ${txid}:${input.index}`)
      })

      // Use transactions exactly as returned by Prover API
      // DO NOT modify the spell TX structure - it has 2 inputs by design:
      //   - Input 0: Funding UTXO (for ZK proof verification)
      //   - Input 1: Commit TX output (actual spend)
      // The ZK proof signature is valid for this exact structure
      // Modifying it causes "Invalid Schnorr signature" error
      // Both transactions must be broadcast together using Bitcoin Core's submitpackage RPC
      console.log('✅ Using transactions as-is from Prover API (spell TX has', spellTxParsed.ins.length, 'inputs)')
      console.log('Spell TX witness contains ZK proof signature - keeping intact')

      console.log('===========================')


      // Try broadcasting directly first (Charms transactions might be pre-signed)
      console.log('Broadcasting transactions (attempting without wallet signature)...')
      console.log('Commit TX length:', commitTx.length, 'chars')
      console.log('Spell TX length:', spellTx.length, 'chars')

      let vaultTxid: string

      try {
        vaultTxid = await bitcoinClient.broadcastPackage(commitTx, spellTx)
        console.log('Success! Transactions were already signed by Prover API')
      } catch (broadcastError: any) {
        console.log('Direct broadcast failed:', broadcastError.message)
        console.log('Attempting to sign with wallet...')

        // Convert raw transactions to PSBTs for wallet signing
        const network = import.meta.env.VITE_BITCOIN_NETWORK === 'testnet4' ? 'testnet' : 'mainnet'

        console.log('Converting commit TX to PSBT...')
        const commitPsbtHex = convertRawTxToPsbt(
          commitTx,
          prevTxHex,
          fundingUTXO.vout,
          network
        )

        console.log('Signing commit TX PSBT with wallet...')
        const signedCommitPsbt = await activeWallet.signTransaction(commitPsbtHex)

        console.log('Extracting signed commit TX from PSBT...')
        const signedCommitTx = extractTxFromPsbt(signedCommitPsbt, network)

        console.log('Spell TX does not need wallet signature - using signed commit TX only')
        // The spell TX likely already has ZK proof witness data from Prover API
        // Only the commit TX needs user wallet signature (which we just did)
        // The spell TX spends from the commit TX output using the ZK proof, not a signature

        // Use the spell TX as-is from the Prover API
        const signedSpellTx = spellTx

        vaultTxid = await bitcoinClient.broadcastPackage(
          signedCommitTx,
          signedSpellTx
        )
      }

        console.log(`Vault created! TXID: ${vaultTxid}`)

        // UNLOCK UTXO after successful vault creation
        utxoLockService.unlockUTXO(utxoId)
        console.log(`🔓 Unlocked UTXO ${utxoId} after successful vault creation`)

        // Create vault object for cache
        const vault: Vault = {
          id: `${vaultTxid}:0`,
          type: 'Inheritance',
          status: InheritanceStatus.Active,
          lockedBTC: amount / 100000000, // Convert satoshis to BTC
          unlockDate: this.calculateUnlockDate(currentBlock, triggerDelayBlocks),
          unlockBlock: currentBlock + triggerDelayBlocks,
          createdAt: new Date().toISOString(),
          createdBlock: currentBlock,
          beneficiaries: beneficiaries.map((b) => ({ ...b })),
          ownerPubkey: walletState.publicKey,
          triggerDelayBlocks,
          transactions: [
            {
              txid: vaultTxid,
              type: 'create',
              timestamp: new Date().toISOString(),
              blockHeight: currentBlock,
              confirmations: 0,
            },
          ],
        }

        // Cache vault
        this.vaultsCache.set(vault.id, vault)

        // Store in localStorage for persistence
        this.saveVaultToStorage(vault)

        return vaultTxid

      } catch (innerError: any) {
        // UNLOCK UTXO on error
        utxoLockService.unlockUTXO(utxoId)
        console.log(`🔓 Unlocked UTXO ${utxoId} after error`)

        // Re-throw the error to be handled by outer catch
        throw innerError
      }
    } catch (error: any) {
      // Detect duplicate UTXO error from Prover API
      if (error.message?.includes('duplicate funding UTXO') && fundingUTXO) {
        this.markUTXOFailed(fundingUTXO, error.message)
        throw new CharmVaultError(
          'This UTXO was already used in a previous request. The app will automatically use a different UTXO on your next attempt. Please try again or refresh your wallet.',
          'DUPLICATE_UTXO',
          error
        )
      }

      if (error instanceof CharmVaultError) {
        throw error
      }
      throw new CharmVaultError(
        `Failed to create vault: ${error.message}`,
        'CREATE_VAULT_ERROR',
        error
      )
    }
  }

  /**
   * Perform check-in (extends deadline)
   */
  async checkin(vaultId: string): Promise<string> {
    try {
      const vault = await this.getVault(vaultId)

      if (vault.status !== InheritanceStatus.Active) {
        throw new CharmVaultError(
          'Can only check in on active vaults',
          'INVALID_VAULT_STATUS'
        )
      }

      const activeWallet = this.getActiveWallet()
      if (!activeWallet) {
        throw new CharmVaultError('Wallet not connected', 'WALLET_NOT_CONNECTED')
      }
      const walletState = activeWallet.state

      // Parse vault UTXO
      const [txid, voutStr] = vaultId.split(':')
      const vaultUTXO: UTXO = {
        txid,
        vout: parseInt(voutStr, 10),
        value: Math.floor(vault.lockedBTC * 100000000),
        scriptPubKey: '',
      }

      // Build vault charm
      const vaultCharm: InheritanceContent = {
        owner_pubkey: vault.ownerPubkey,
        last_checkin_block: vault.createdBlock,
        trigger_delay_blocks: vault.triggerDelayBlocks,
        beneficiaries: vault.beneficiaries,
        status: InheritanceStatus.Active,
      }

      const currentBlock = await bitcoinClient.getCurrentBlockHeight()
      const feeEstimates = await bitcoinClient.getFeeEstimates()

      const spell = await spellBuilder.buildCheckinSpell({
        vaultUTXO,
        vaultCharm,
        ownerPubkey: walletState.publicKey,
        currentBlock,
        changeAddress: walletState.address,
        feeRate: feeEstimates.halfHourFee || 2.0,
      })

      const prevTxHex = await bitcoinClient.getRawTransaction(txid)
      const proverRequest = await proverClient.buildProverRequest(
        spell,
        [prevTxHex],
        vaultId,
        vaultUTXO.value,
        walletState.address,
        feeEstimates.halfHourFee || 2.0
      )

      console.log('Generating ZK proof for check-in...')
      const proverResponse = await proverClient.proveSpell(proverRequest)

      const [commitTx, spellTx] = proverResponse
      const signedCommitTx = await activeWallet.signTransaction(commitTx)
      const signedSpellTx = await activeWallet.signTransaction(spellTx)

      const checkinTxid = await bitcoinClient.broadcastPackage(signedCommitTx, signedSpellTx)

      console.log(`Check-in successful! TXID: ${checkinTxid}`)

      // Update vault
      vault.unlockBlock = currentBlock + vault.triggerDelayBlocks
      vault.unlockDate = this.calculateUnlockDate(currentBlock, vault.triggerDelayBlocks)
      this.saveVaultToStorage(vault)

      return checkinTxid
    } catch (error: any) {
      if (error instanceof CharmVaultError) {
        throw error
      }
      throw new CharmVaultError(
        `Failed to check in: ${error.message}`,
        'CHECKIN_ERROR',
        error
      )
    }
  }

  /**
   * Update beneficiaries
   */
  async updateBeneficiaries(
    vaultId: string,
    newBeneficiaries: Beneficiary[]
  ): Promise<string> {
    try {
      if (!spellBuilder.validateBeneficiaries(newBeneficiaries)) {
        throw new CharmVaultError(
          'Beneficiary percentages must sum to exactly 100%',
          'VALIDATION_ERROR'
        )
      }

      const vault = await this.getVault(vaultId)

      if (vault.status !== InheritanceStatus.Active) {
        throw new CharmVaultError(
          'Can only update beneficiaries on active vaults',
          'INVALID_VAULT_STATUS'
        )
      }

      const activeWallet = this.getActiveWallet()
      if (!activeWallet) {
        throw new CharmVaultError('Wallet not connected', 'WALLET_NOT_CONNECTED')
      }
      const walletState = activeWallet.state

      const [txid, voutStr] = vaultId.split(':')
      const vaultUTXO: UTXO = {
        txid,
        vout: parseInt(voutStr, 10),
        value: Math.floor(vault.lockedBTC * 100000000),
        scriptPubKey: '',
      }

      const vaultCharm: InheritanceContent = {
        owner_pubkey: vault.ownerPubkey,
        last_checkin_block: vault.createdBlock,
        trigger_delay_blocks: vault.triggerDelayBlocks,
        beneficiaries: vault.beneficiaries,
        status: InheritanceStatus.Active,
      }

      const currentBlock = await bitcoinClient.getCurrentBlockHeight()
      const feeEstimates = await bitcoinClient.getFeeEstimates()

      const spell = await spellBuilder.buildUpdateBeneficiariesSpell({
        vaultUTXO,
        vaultCharm,
        newBeneficiaries,
        ownerPubkey: walletState.publicKey,
        currentBlock,
        changeAddress: walletState.address,
        feeRate: feeEstimates.halfHourFee || 2.0,
      })

      const prevTxHex = await bitcoinClient.getRawTransaction(txid)
      const proverRequest = await proverClient.buildProverRequest(
        spell,
        [prevTxHex],
        vaultId,
        vaultUTXO.value,
        walletState.address,
        feeEstimates.halfHourFee || 2.0
      )

      console.log('Generating ZK proof for update...')
      const proverResponse = await proverClient.proveSpell(proverRequest)

      const [commitTx, spellTx] = proverResponse
      const signedCommitTx = await activeWallet.signTransaction(commitTx)
      const signedSpellTx = await activeWallet.signTransaction(spellTx)

      const newTxid = await bitcoinClient.broadcastPackage(
        signedCommitTx,
        signedSpellTx
      )

      console.log(`Beneficiaries updated! TXID: ${newTxid}`)

      // Update vault
      vault.beneficiaries = newBeneficiaries.map((b) => ({ ...b }))
      vault.unlockBlock = currentBlock + vault.triggerDelayBlocks
      vault.unlockDate = this.calculateUnlockDate(currentBlock, vault.triggerDelayBlocks)
      this.saveVaultToStorage(vault)

      return newTxid
    } catch (error: any) {
      if (error instanceof CharmVaultError) {
        throw error
      }
      throw new CharmVaultError(
        `Failed to update beneficiaries: ${error.message}`,
        'UPDATE_ERROR',
        error
      )
    }
  }

  /**
   * Distribute vault (trigger inheritance)
   */
  async distribute(vaultId: string): Promise<string> {
    try {
      const vault = await this.getVault(vaultId)

      const currentBlock = await bitcoinClient.getCurrentBlockHeight()

      if (currentBlock <= vault.unlockBlock) {
        throw new CharmVaultError(
          `Vault cannot be distributed yet. Unlock block: ${vault.unlockBlock}, Current block: ${currentBlock}`,
          'VAULT_LOCKED'
        )
      }

      const [txid, voutStr] = vaultId.split(':')
      const vaultUTXO: UTXO = {
        txid,
        vout: parseInt(voutStr, 10),
        value: Math.floor(vault.lockedBTC * 100000000),
        scriptPubKey: '',
      }

      const vaultCharm: InheritanceContent = {
        owner_pubkey: vault.ownerPubkey,
        last_checkin_block: vault.createdBlock,
        trigger_delay_blocks: vault.triggerDelayBlocks,
        beneficiaries: vault.beneficiaries,
        status: InheritanceStatus.Active,
      }

      const feeEstimates = await bitcoinClient.getFeeEstimates()

      const spell = await spellBuilder.buildDistributeSpell({
        vaultUTXO,
        vaultCharm,
        currentBlock,
        feeRate: feeEstimates.halfHourFee || 2.0,
      })

      const prevTxHex = await bitcoinClient.getRawTransaction(txid)
      const proverRequest = await proverClient.buildProverRequest(
        spell,
        [prevTxHex],
        vaultId,
        vaultUTXO.value,
        vault.beneficiaries[0].address, // Use first beneficiary as change address
        feeEstimates.halfHourFee || 2.0
      )

      console.log('Generating ZK proof for distribution...')
      const proverResponse = await proverClient.proveSpell(proverRequest)

      // For distribution, we may not need wallet signature if anyone can trigger
      // But for MVP, we'll use wallet signature
      const activeWallet = this.getActiveWallet()
      if (!activeWallet) {
        throw new CharmVaultError('Wallet not connected', 'WALLET_NOT_CONNECTED')
      }

      const [commitTx, spellTx] = proverResponse
      const signedCommitTx = await activeWallet.signTransaction(commitTx)
      const signedSpellTx = await activeWallet.signTransaction(spellTx)

      const distributeTxid = await bitcoinClient.broadcastPackage(
        signedCommitTx,
        signedSpellTx
      )

      console.log(`Vault distributed! TXID: ${distributeTxid}`)

      // Update vault status
      vault.status = InheritanceStatus.Distributed
      this.saveVaultToStorage(vault)

      return distributeTxid
    } catch (error: any) {
      if (error instanceof CharmVaultError) {
        throw error
      }
      throw new CharmVaultError(
        `Failed to distribute vault: ${error.message}`,
        'DISTRIBUTE_ERROR',
        error
      )
    }
  }

  /**
   * Get vault by ID
   */
  async getVault(vaultId: string): Promise<Vault> {
    // Check cache first
    if (this.vaultsCache.has(vaultId)) {
      return this.vaultsCache.get(vaultId)!
    }

    // Load from localStorage
    const vault = this.loadVaultFromStorage(vaultId)
    if (vault) {
      this.vaultsCache.set(vaultId, vault)
      return vault
    }

    throw new CharmVaultError(`Vault ${vaultId} not found`, 'VAULT_NOT_FOUND')
  }

  /**
   * Get all vaults for connected wallet
   */
  getAllVaults(): Vault[] {
    const vaults: Vault[] = []
    const keys = Object.keys(localStorage)

    for (const key of keys) {
      if (key.startsWith('vault_')) {
        try {
          const vaultData = localStorage.getItem(key)
          if (vaultData) {
            const vault = JSON.parse(vaultData)
            vaults.push(vault)
          }
        } catch (error) {
          console.error(`Failed to parse vault ${key}:`, error)
        }
      }
    }

    return vaults
  }

  /**
   * Helper: Select suitable UTXO for funding
   */
  private selectFundingUTXO(utxos: UTXO[], requiredAmount: number): UTXO | null {
    const now = Date.now()
    const FAILURE_COOLDOWN = 5 * 60 * 1000 // 5 minutes

    // Clear expired locks before selecting
    utxoLockService.clearExpiredLocks()

    // Find smallest UTXO that covers amount AND is not failed/pending/locked
    const suitableUTXOs = utxos
      .filter((utxo) => {
        if (utxo.value < requiredAmount) return false

        const utxoId = `${utxo.txid}:${utxo.vout}`

        // Skip if UTXO is currently locked (in-flight to Prover)
        if (utxoLockService.isLocked(utxoId)) {
          console.log(`🔒 Skipping UTXO ${utxoId} (currently locked)`)
          return false
        }

        // Skip if failed recently (within cooldown period)
        const failure = this.failedUTXOs.get(utxoId)
        if (failure && (now - failure.lastFailed) < FAILURE_COOLDOWN) {
          console.log(`⏭️ Skipping UTXO ${utxoId} (failed ${failure.count} times, cooling down)`)
          return false
        }

        return true
      })
      .sort((a, b) => a.value - b.value)

    return suitableUTXOs[0] || null
  }

  /**
   * Mark a UTXO as failed (e.g., when Prover API returns duplicate error)
   */
  private markUTXOFailed(utxo: UTXO, reason: string): void {
    const utxoId = `${utxo.txid}:${utxo.vout}`
    const existing = this.failedUTXOs.get(utxoId)

    this.failedUTXOs.set(utxoId, {
      count: (existing?.count || 0) + 1,
      lastFailed: Date.now()
    })

    console.warn(`⚠️ UTXO ${utxoId} marked as failed (attempt ${(existing?.count || 0) + 1}): ${reason}`)
  }

  /**
   * Helper: Calculate unlock date from block height
   */
  private calculateUnlockDate(_currentBlock: number, delayBlocks: number): string {
    // Average block time: 10 minutes
    const unlockTimestamp = Date.now() + delayBlocks * 10 * 60 * 1000
    return new Date(unlockTimestamp).toISOString()
  }

  /**
   * Helper: Save vault to localStorage
   */
  private saveVaultToStorage(vault: Vault): void {
    try {
      localStorage.setItem(`vault_${vault.id}`, JSON.stringify(vault))
    } catch (error) {
      console.error('Failed to save vault to storage:', error)
    }
  }

  /**
   * Helper: Load vault from localStorage
   */
  private loadVaultFromStorage(vaultId: string): Vault | null {
    try {
      const vaultData = localStorage.getItem(`vault_${vaultId}`)
      if (vaultData) {
        return JSON.parse(vaultData)
      }
    } catch (error) {
      console.error('Failed to load vault from storage:', error)
    }
    return null
  }
}

// Export singleton instance
export const vaultService = new VaultService()
export default vaultService
