import {
  SpellJSON,
  Beneficiary,
  InheritanceContent,
  InheritanceStatus,
  CreateVaultParams,
  CheckinParams,
  UpdateBeneficiariesParams,
  DistributeVaultParams,
} from '../../types/charms'
import { proverClient } from './proverClient'

class SpellBuilder {
  /**
   * Build spell for creating a new vault (inheritance)
   */
  async buildCreateVaultSpell(params: CreateVaultParams): Promise<SpellJSON> {
    const { amount, fundingUTXO, ownerPubkey, beneficiaries, triggerDelayBlocks, changeAddress } = params

    // Calculate app reference
    const fundingUtxoId = `${fundingUTXO.txid}:${fundingUTXO.vout}`
    const appRef = await proverClient.buildAppReference(fundingUtxoId)

    // Build InheritanceContent
    const inheritanceContent: InheritanceContent = {
      owner_pubkey: ownerPubkey,
      last_checkin_block: 0, // Will be set by contract based on current block
      trigger_delay_blocks: triggerDelayBlocks,
      beneficiaries: beneficiaries,
      status: InheritanceStatus.Active,
    }

    // Build spell JSON
    const spell: SpellJSON = {
      version: 8,
      apps: {
        $00: appRef,
      },
      ins: [
        {
          utxo_id: fundingUtxoId,
          charms: {}, // Empty charms = plain BTC UTXO (no existing charm)
        },
      ],
      outs: [
        {
          address: changeAddress,
          sats: amount, // User's requested vault amount (Prover API handles change automatically)
          charms: {
            $00: inheritanceContent,
          },
        },
      ],
      private_inputs: {
        $00: fundingUtxoId,
      },
    }

    return spell
  }

  /**
   * Build spell for check-in (extends deadline)
   */
  async buildCheckinSpell(params: CheckinParams): Promise<SpellJSON> {
    const { vaultUTXO, vaultCharm, ownerPubkey, currentBlock, changeAddress } = params

    // Calculate app reference (same as vault's app)
    const fundingUtxoId = `${vaultUTXO.txid}:${vaultUTXO.vout}`
    const appId = await proverClient.calculateAppId(fundingUtxoId)
    const appVk = proverClient.getAppVk()
    const appRef = `n/${appId}/${appVk}`

    // Update last_checkin_block
    const updatedCharm: InheritanceContent = {
      ...vaultCharm,
      last_checkin_block: currentBlock,
      owner_pubkey: ownerPubkey,
    }

    const spell: SpellJSON = {
      version: 8,
      apps: {
        $00: appRef,
      },
      ins: [
        {
          utxo_id: fundingUtxoId,
          charms: {
            $00: vaultCharm,
          },
        },
      ],
      outs: [
        {
          address: changeAddress,
          sats: vaultUTXO.value - 2000, // Deduct fees (Charms ZK proofs)
          charms: {
            $00: updatedCharm,
          },
        },
      ],
    }

    return spell
  }

  /**
   * Build spell for updating beneficiaries
   */
  async buildUpdateBeneficiariesSpell(
    params: UpdateBeneficiariesParams
  ): Promise<SpellJSON> {
    const {
      vaultUTXO,
      vaultCharm,
      newBeneficiaries,
      ownerPubkey,
      currentBlock,
      changeAddress,
    } = params

    // Calculate app reference
    const fundingUtxoId = `${vaultUTXO.txid}:${vaultUTXO.vout}`
    const appId = await proverClient.calculateAppId(fundingUtxoId)
    const appVk = proverClient.getAppVk()
    const appRef = `n/${appId}/${appVk}`

    // Update beneficiaries and extend deadline
    const updatedCharm: InheritanceContent = {
      ...vaultCharm,
      beneficiaries: newBeneficiaries,
      last_checkin_block: currentBlock,
      owner_pubkey: ownerPubkey,
    }

    const spell: SpellJSON = {
      version: 8,
      apps: {
        $00: appRef,
      },
      ins: [
        {
          utxo_id: fundingUtxoId,
          charms: {
            $00: vaultCharm,
          },
        },
      ],
      outs: [
        {
          address: changeAddress,
          sats: vaultUTXO.value - 2000, // Deduct fees (Charms ZK proofs)
          charms: {
            $00: updatedCharm,
          },
        },
      ],
    }

    return spell
  }

  /**
   * Build spell for distribution (inheritance triggered)
   */
  async buildDistributeSpell(params: DistributeVaultParams): Promise<SpellJSON> {
    const { vaultUTXO, vaultCharm, currentBlock } = params

    // Calculate app reference
    const fundingUtxoId = `${vaultUTXO.txid}:${vaultUTXO.vout}`
    const appId = await proverClient.calculateAppId(fundingUtxoId)
    const appVk = proverClient.getAppVk()
    const appRef = `n/${appId}/${appVk}`

    // Verify deadline has passed
    const deadline = vaultCharm.last_checkin_block + vaultCharm.trigger_delay_blocks
    if (currentBlock <= deadline) {
      throw new Error(
        `Deadline not reached. Current block: ${currentBlock}, Deadline: ${deadline}`
      )
    }

    // Calculate distribution amounts (deduct fees first)
    const estimatedFee = 2000 // Charms ZK proof fees
    const totalValue = vaultUTXO.value - estimatedFee
    const outputs = vaultCharm.beneficiaries.map((beneficiary) => {
      const amount = Math.floor((totalValue * beneficiary.percentage) / 100)
      return {
        address: beneficiary.address,
        sats: amount,
      }
    })

    const spell: SpellJSON = {
      version: 8,
      apps: {
        $00: appRef,
      },
      ins: [
        {
          utxo_id: fundingUtxoId,
          charms: {
            $00: vaultCharm,
          },
        },
      ],
      outs: outputs,
      // Note: No charms in outputs = NFT is burned
    }

    return spell
  }

  /**
   * Validate beneficiaries (percentages must sum to 100)
   */
  validateBeneficiaries(beneficiaries: Beneficiary[]): boolean {
    const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
    return totalPercentage === 100
  }

  /**
   * Calculate estimated fee for spell transaction
   */
  estimateFee(
    numInputs: number,
    numOutputs: number,
    feeRate: number = 2.0
  ): number {
    // Rough estimate:
    // - Each input: ~150 vbytes (Taproot input with witness)
    // - Each output: ~50 vbytes (Taproot output)
    // - Base transaction: ~50 vbytes
    const estimatedVbytes = 50 + numInputs * 150 + numOutputs * 50
    return Math.ceil(estimatedVbytes * feeRate)
  }

  /**
   * Parse UTXO ID string to UTXO object
   */
  parseUtxoId(utxoId: string): { txid: string; vout: number } {
    const [txid, voutStr] = utxoId.split(':')
    return {
      txid,
      vout: parseInt(voutStr, 10),
    }
  }

  /**
   * Format UTXO to ID string
   */
  formatUtxoId(txid: string, vout: number): string {
    return `${txid}:${vout}`
  }
}

// Export singleton instance
export const spellBuilder = new SpellBuilder()
export default spellBuilder
