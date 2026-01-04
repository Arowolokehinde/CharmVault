// Vault Parameters Storage Service
// Stores vault creation parameters in localStorage for display on detail page

import type { Beneficiary } from '../types/charms'

export interface VaultParams {
  name: string
  amount: number // satoshis
  beneficiaries: Beneficiary[]
  triggerDelayBlocks: number
  createdAt: string
  ownerAddress: string
  ownerPublicKey: string
  type?: 'vault' | 'savings' // Type to differentiate between vaults and savings
}

class VaultParamsService {
  private static STORAGE_KEY = 'charmvault_vault_params'

  /**
   * Get vault parameters for a specific vault UTXO
   */
  getParams(vaultUtxo: string): VaultParams | null {
    try {
      const allParams = this.getAllParams()
      return allParams[vaultUtxo] || null
    } catch (error) {
      console.warn('Failed to get vault params:', error)
      return null
    }
  }

  /**
   * Save vault parameters after creation
   */
  saveParams(vaultUtxo: string, params: VaultParams): void {
    try {
      const allParams = this.getAllParams()
      allParams[vaultUtxo] = params
      localStorage.setItem(VaultParamsService.STORAGE_KEY, JSON.stringify(allParams))
      console.log(`✅ Saved params for vault ${vaultUtxo}`)
    } catch (error) {
      console.warn('Failed to save vault params:', error)
    }
  }

  /**
   * Get all vault parameters
   */
  private getAllParams(): Record<string, VaultParams> {
    try {
      const stored = localStorage.getItem(VaultParamsService.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  /**
   * Clear all vault parameters (for testing)
   */
  clearAll(): void {
    localStorage.removeItem(VaultParamsService.STORAGE_KEY)
  }
}

// Export singleton instance
export const vaultParams = new VaultParamsService()
export default vaultParams
