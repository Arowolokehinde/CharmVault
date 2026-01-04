import axios from 'axios'
import { BitcoinTransaction, BitcoinError } from '../../types/charms'

class BitcoinClient {
  private network: string
  private explorerApiUrl: string

  constructor() {
    this.network = import.meta.env.VITE_BITCOIN_NETWORK || 'testnet4'
    this.explorerApiUrl =
      this.network === 'testnet4'
        ? 'https://mempool.space/testnet4/api'
        : 'https://mempool.space/api'
  }

  /**
   * Get raw transaction by txid
   */
  async getRawTransaction(txid: string): Promise<string> {
    try {
      const response = await axios.get(`${this.explorerApiUrl}/tx/${txid}/hex`)
      return response.data
    } catch (error: any) {
      throw new BitcoinError(
        `Failed to fetch transaction ${txid}: ${error.message}`,
        error
      )
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const [txData, txHex] = await Promise.all([
        axios.get(`${this.explorerApiUrl}/tx/${txid}`),
        this.getRawTransaction(txid),
      ])

      const tx = txData.data

      return {
        txid: tx.txid,
        hex: txHex,
        confirmations: tx.status.confirmed ? tx.status.block_height : 0,
        blockHeight: tx.status.block_height,
        timestamp: tx.status.block_time,
      }
    } catch (error: any) {
      throw new BitcoinError(
        `Failed to fetch transaction details: ${error.message}`,
        error
      )
    }
  }

  /**
   * Broadcast a single transaction
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const response = await axios.post(`${this.explorerApiUrl}/tx`, txHex, {
        headers: {
          'Content-Type': 'text/plain',
        },
      })

      // Response is the txid
      return response.data
    } catch (error: any) {
      const errorMessage = error.response?.data || error.message
      throw new BitcoinError(`Failed to broadcast transaction: ${errorMessage}`, error)
    }
  }

  /**
   * Broadcast transaction package using Bitcoin Core's submitpackage RPC
   * CRITICAL: For Charms, both transactions MUST be broadcast atomically
   * Sequential broadcast causes "Invalid Schnorr signature" error
   */
  async broadcastPackage(commitTxHex: string, spellTxHex: string): Promise<string> {
    const rpcHost = import.meta.env.VITE_BITCOIN_RPC_HOST || 'localhost'
    const rpcPort = import.meta.env.VITE_BITCOIN_RPC_PORT || '18332'
    const rpcUser = import.meta.env.VITE_BITCOIN_RPC_USER
    const rpcPassword = import.meta.env.VITE_BITCOIN_RPC_PASSWORD

    if (!rpcUser || !rpcPassword) {
      throw new BitcoinError(
        'Bitcoin Core RPC not configured. Package relay is REQUIRED for Charms transactions.\n\n' +
          'Please add to your .env file:\n' +
          'VITE_BITCOIN_RPC_USER=your_username\n' +
          'VITE_BITCOIN_RPC_PASSWORD=your_password\n\n' +
          'Then restart the dev server.',
        new Error('RPC credentials missing')
      )
    }

    try {
      console.log('🔄 Broadcasting package via Bitcoin Core submitpackage RPC...')

      const rpcUrl = `http://${rpcHost}:${rpcPort}/rpc`
      const auth = btoa(`${rpcUser}:${rpcPassword}`)

      const response = await axios.post(
        rpcUrl,
        {
          jsonrpc: '1.0',
          id: 'charmvault',
          method: 'submitpackage',
          params: [[commitTxHex, spellTxHex]],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
        }
      )

      if (response.data.error) {
        throw new Error(`RPC error: ${JSON.stringify(response.data.error)}`)
      }

      const result = response.data.result
      console.log('✅ Package broadcast result:', result)

      // Extract spell TXID - try different result formats
      let spellTxid: string | undefined

      if (result.tx_results) {
        // Format: { tx_results: { "txhex": { txid: "..." } } }
        const txResults = result.tx_results as Record<string, any>
        spellTxid = txResults[spellTxHex]?.txid || (Object.values(txResults)[1] as any)?.txid
      }

      if (!spellTxid) {
        // Fallback: calculate txid from spell TX hex
        const bitcoin = await import('bitcoinjs-lib')
        const spellTx = bitcoin.Transaction.fromHex(spellTxHex)
        spellTxid = spellTx.getId()
        console.log('📝 Calculated spell TXID:', spellTxid)
      }

      console.log(`✅ Package broadcast successful! Spell TXID: ${spellTxid}`)
      return spellTxid
    } catch (error: any) {
      console.error('❌ Bitcoin Core RPC failed:', error)

      // CORS error detection
      if (
        error.message?.toLowerCase().includes('cors') ||
        error.code === 'ERR_NETWORK' ||
        error.message?.includes('Failed to fetch')
      ) {
        throw new BitcoinError(
          '🚫 CORS Error: Cannot connect to Bitcoin Core from browser.\n\n' +
            '📝 Add this line to your bitcoin.conf:\n' +
            'rpcallowcors=*\n\n' +
            '🔄 Then restart Bitcoin Core:\n' +
            'bitcoin-cli stop && bitcoind -daemon\n\n' +
            '📍 bitcoin.conf location (macOS):\n' +
            '~/Library/Application Support/Bitcoin/bitcoin.conf',
          error
        )
      }

      // Connection refused
      if (error.code === 'ECONNREFUSED') {
        throw new BitcoinError(
          '🔌 Cannot connect to Bitcoin Core RPC.\n\n' +
            '✅ Make sure Bitcoin Core is running:\n' +
            'bitcoind -daemon\n\n' +
            '🔍 Check it\'s running:\n' +
            'bitcoin-cli -testnet4 getblockcount',
          error
        )
      }

      // Auth error
      if (error.response?.status === 401) {
        throw new BitcoinError(
          '🔐 Bitcoin Core RPC authentication failed.\n\n' +
            'Check your .env credentials match bitcoin.conf:\n' +
            'rpcuser=your_username\n' +
            'rpcpassword=your_password',
          error
        )
      }

      throw new BitcoinError(
        `Failed to broadcast package: ${error.message}\n\n` +
          'Ensure Bitcoin Core is running and configured for RPC access.',
        error
      )
    }
  }

  /**
   * Get current block height
   */
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await axios.get(`${this.explorerApiUrl}/blocks/tip/height`)
      return parseInt(response.data, 10)
    } catch (error: any) {
      throw new BitcoinError(`Failed to get block height: ${error.message}`, error)
    }
  }

  /**
   * Get fee estimates (satoshis per vbyte)
   */
  async getFeeEstimates(): Promise<{
    fastestFee: number
    halfHourFee: number
    hourFee: number
    economyFee: number
    minimumFee: number
  }> {
    try {
      const response = await axios.get(`${this.explorerApiUrl}/v1/fees/recommended`)
      return response.data
    } catch (error: any) {
      // Fallback to default fee rates if API fails
      console.warn('Failed to fetch fee estimates, using defaults:', error.message)
      return {
        fastestFee: 10,
        halfHourFee: 5,
        hourFee: 3,
        economyFee: 2,
        minimumFee: 1,
      }
    }
  }

  /**
   * Get address balance
   */
  async getAddressBalance(address: string): Promise<number> {
    try {
      const response = await axios.get(`${this.explorerApiUrl}/address/${address}`)
      const addressData = response.data

      return (
        addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum
      )
    } catch (error: any) {
      throw new BitcoinError(
        `Failed to get address balance: ${error.message}`,
        error
      )
    }
  }

  /**
   * Get UTXOs for an address
   */
  async getAddressUTXOs(address: string): Promise<
    Array<{
      txid: string
      vout: number
      value: number
      status: { confirmed: boolean; block_height?: number }
    }>
  > {
    try {
      const response = await axios.get(`${this.explorerApiUrl}/address/${address}/utxo`)
      return response.data
    } catch (error: any) {
      throw new BitcoinError(`Failed to get address UTXOs: ${error.message}`, error)
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(txid: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txid)
      return tx.confirmations > 0
    } catch (error: any) {
      throw new BitcoinError(
        `Failed to check transaction confirmation: ${error.message}`,
        error
      )
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txid: string,
    requiredConfirmations: number = 1,
    timeout: number = 600000 // 10 minutes default
  ): Promise<BitcoinTransaction> {
    const startTime = Date.now()
    const pollInterval = 10000 // 10 seconds

    while (Date.now() - startTime < timeout) {
      try {
        const tx = await this.getTransaction(txid)

        if (tx.confirmations >= requiredConfirmations) {
          return tx
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      } catch (error: any) {
        // If transaction not found yet, continue polling
        if (error.message.includes('not found')) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
          continue
        }
        throw error
      }
    }

    throw new BitcoinError(
      `Transaction ${txid} did not confirm within ${timeout / 1000} seconds`
    )
  }

  /**
   * Get explorer URL for a transaction
   */
  getExplorerUrl(txid: string): string {
    const baseUrl = import.meta.env.VITE_BITCOIN_EXPLORER || 'https://mempool.space/testnet4'
    return `${baseUrl}/tx/${txid}`
  }

  /**
   * Get explorer URL for an address
   */
  getAddressExplorerUrl(address: string): string {
    const baseUrl = import.meta.env.VITE_BITCOIN_EXPLORER || 'https://mempool.space/testnet4'
    return `${baseUrl}/address/${address}`
  }
}

// Export singleton instance
export const bitcoinClient = new BitcoinClient()
export default bitcoinClient
