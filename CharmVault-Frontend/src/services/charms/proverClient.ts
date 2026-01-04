import axios from 'axios'
import { ProverRequest, ProverResponse, ProverError } from '../../types/charms'

class ProverClient {
  private proverApiUrl: string
  private appVk: string
  private wasmCache: string | null = null

  constructor() {
    this.proverApiUrl = import.meta.env.VITE_CHARMS_PROVER_API || 'https://v8.charms.dev/spells/prove'
    this.appVk = import.meta.env.VITE_APP_VK || ''

    if (!this.appVk) {
      console.warn('VITE_APP_VK environment variable not set')
    }
  }

  /**E
   * Load contract WASM from public directory and convert to base64
   */
  async loadContractWasm(): Promise<string> {
    // Return cached WASM if available
    if (this.wasmCache) {
      return this.wasmCache
    }

    try {
      const wasmPath = import.meta.env.VITE_WASM_PATH || '/wasm/my-token.wasm'
      const response = await fetch(wasmPath)

      if (!response.ok) {
        throw new Error(`Failed to load WASM: ${response.statusText}`)
      }

      const wasmArrayBuffer = await response.arrayBuffer()
      const wasmBytes = new Uint8Array(wasmArrayBuffer)

      // Convert to base64
      const base64Wasm = btoa(
        wasmBytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
      )

      // Cache for future use
      this.wasmCache = base64Wasm

      return base64Wasm
    } catch (error: any) {
      throw new ProverError(`Failed to load contract WASM: ${error.message}`, error)
    }
  }

  /**
   * Send spell to Prover API and get commit + spell transactions
   * This is the core integration point with Charms Protocol
   */
  async proveSpell(request: ProverRequest): Promise<ProverResponse> {
    try {
      console.log('Sending spell to Prover API...')
      console.log('Spell:', JSON.stringify(request.spell, null, 2))

      const response = await axios.post<ProverResponse>(this.proverApiUrl, request, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 600000, // 10 minutes (ZK proof generation can be slow)
      })

      console.log('Prover response received')
      console.log('Response type:', Array.isArray(response.data) ? 'array' : 'object')
      console.log('Response data:', response.data)

      // Response is [commit_tx, spell_tx] array
      const [commitTxData, spellTxData] = response.data

      // Extract transaction hex from response
      // The API wraps transactions in { bitcoin: "hex" } format
      let commitTx: string
      let spellTx: string

      if (typeof commitTxData === 'string') {
        // Direct string response
        commitTx = commitTxData
        spellTx = spellTxData as string
      } else if (typeof commitTxData === 'object' && commitTxData !== null) {
        // Object response - extract from 'bitcoin' property
        commitTx = (commitTxData as any).bitcoin || JSON.stringify(commitTxData)
        spellTx = (spellTxData as any).bitcoin || JSON.stringify(spellTxData)

        console.log('Extracted commit TX from object:', commitTx.substring(0, 100) + '...')
        console.log('Extracted spell TX from object:', spellTx.substring(0, 100) + '...')
      } else {
        throw new Error('Unexpected response format from Prover API')
      }

      // Return as array of hex strings
      return [commitTx, spellTx]
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message
      console.error('Prover API error:', errorMessage)
      console.error('Full error response:', JSON.stringify(error.response?.data, null, 2))
      console.error('Request that failed:', JSON.stringify(request, null, 2))

      // Provide helpful message for duplicate UTXO error
      if (errorMessage.includes('duplicate funding UTXO')) {
        throw new ProverError(
          `Duplicate UTXO: This UTXO was already submitted to the Prover API. ${errorMessage}`,
          error
        )
      }

      throw new ProverError(`Prover API failed: ${errorMessage}`, error)
    }
  }

  /**
   * Build prover request from spell JSON
   */
  async buildProverRequest(
    spell: any,
    prevTxs: string[],
    fundingUtxo: string,
    fundingUtxoValue: number,
    changeAddress: string,
    feeRate: number = 2.0
  ): Promise<ProverRequest> {
    try {
      // Load WASM if not already cached
      const wasmBase64 = await this.loadContractWasm()

      // Wrap prev_txs in bitcoin format as expected by the Prover API
      const formattedPrevTxs = prevTxs.map(txHex => ({ bitcoin: txHex }))

      const request: ProverRequest = {
        spell,
        binaries: {
          [this.appVk]: wasmBase64,
        },
        prev_txs: formattedPrevTxs,
        funding_utxo: fundingUtxo,
        funding_utxo_value: fundingUtxoValue,
        change_address: changeAddress,
        fee_rate: feeRate,
        chain: 'bitcoin',
      }

      return request
    } catch (error: any) {
      throw new ProverError(`Failed to build prover request: ${error.message}`, error)
    }
  }

  /**
   * Get app verification key (VK)
   */
  getAppVk(): string {
    return this.appVk
  }

  /**
   * Calculate app ID from funding UTXO
   * app_id = SHA256(funding_utxo)
   */
  async calculateAppId(fundingUtxo: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(fundingUtxo)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    } catch (error: any) {
      throw new ProverError(`Failed to calculate app ID: ${error.message}`, error)
    }
  }

  /**
   * Build app reference for spell
   * Format: "n/<app_id>/<app_vk>"
   */
  async buildAppReference(fundingUtxo: string): Promise<string> {
    const appId = await this.calculateAppId(fundingUtxo)
    return `n/${appId}/${this.appVk}`
  }

  /**
   * Check prover API health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.proverApiUrl.replace('/spells/prove', '/health')}`, {
        timeout: 5000,
      })
      return response.status === 200
    } catch (error) {
      console.warn('Prover API health check failed:', error)
      return false
    }
  }

  /**
   * Estimate proof generation time
   * Based on cycles (rough estimate: ~1 second per 100k cycles)
   */
  estimateProofTime(cycles: number): number {
    // Very rough estimate: ~5 minutes average
    return Math.max(60000, Math.min(600000, cycles / 100))
  }
}

// Export singleton instance
export const proverClient = new ProverClient()
export default proverClient
