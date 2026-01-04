import { WalletState, UTXO, WalletError } from '../../types/charms'

// Leather Wallet Provider Interface (injected by browser extension)
interface LeatherProvider {
  request: (method: string, params?: any) => Promise<any>
}

declare global {
  interface Window {
    LeatherProvider?: LeatherProvider
    btc?: LeatherProvider
  }
}

class LeatherWalletService {
  private provider: LeatherProvider | null = null
  private walletState: WalletState | null = null

  /**
   * Check if Leather wallet is installed
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined' && (!!window.LeatherProvider || !!window.btc)
  }

  /**
   * Detect which network an address belongs to based on its prefix
   */
  private detectAddressNetwork(address: string): string {
    // Bitcoin address prefixes:
    // - Mainnet Taproot: bc1p...
    // - Mainnet SegWit: bc1q...
    // - Testnet Taproot: tb1p...
    // - Testnet SegWit: tb1q...
    if (address.startsWith('bc1p') || address.startsWith('bc1q')) {
      return 'mainnet'
    } else if (address.startsWith('tb1p') || address.startsWith('tb1q')) {
      return 'testnet4'
    }
    throw new WalletError(`Unknown address format: ${address}`)
  }

  /**
   * Get the wallet provider
   */
  private getProvider(): LeatherProvider {
    if (typeof window === 'undefined') {
      throw new WalletError('Window object not available')
    }

    const provider = window.LeatherProvider || window.btc
    if (!provider) {
      throw new WalletError(
        'Leather wallet not installed. Please install from https://leather.io'
      )
    }

    return provider
  }

  /**
   * Connect to Leather wallet
   */
  async connect(): Promise<WalletState> {
    try {
      this.provider = this.getProvider()

      // Request account access
      const response = await this.provider.request('getAddresses')

      if (!response || !response.result || !response.result.addresses) {
        throw new WalletError('Failed to get addresses from wallet')
      }

      // Get Taproot address (p2tr) - required for Charms
      const addresses = response.result.addresses
      console.log('All addresses from Leather:', JSON.stringify(addresses, null, 2))

      // Find Bitcoin Taproot address - REQUIRED for Charms protocol
      // Filter OUT BRC-20 and other tokens
      let taprootAccount = addresses.find((addr: any) => {
        console.log('Checking address:', {
          address: addr.address,
          type: addr.type,
          symbol: addr.symbol,
          name: addr.name,
          purpose: addr.purpose
        })

        // Exclude BRC-20 and other tokens
        const isBRC20 = addr.name?.includes('BRC') || addr.name?.includes('BRC-20') ||
                       addr.address?.startsWith('tb1ptu') || addr.address?.startsWith('bc1ptu')

        if (isBRC20) {
          console.log('Skipping BRC-20 address:', addr.address)
          return false
        }

        // ONLY accept p2tr (Taproot) for Bitcoin - Charms protocol requires this
        return addr.type === 'p2tr' && !isBRC20
      })

      if (!taprootAccount) {
        throw new WalletError(
          'Bitcoin Taproot address required!\n\n' +
          'CharmVault requires a Bitcoin Taproot (P2TR) address to create vaults.\n\n' +
          'Leather wallet only provides SegWit (tb1q...) addresses for Bitcoin, which are not compatible with the Charms protocol.\n\n' +
          'Please use one of these alternatives:\n' +
          '1. Bitcoin Core with testnet4 (recommended for testing)\n' +
          '2. Unisat Wallet (supports Taproot)\n' +
          '3. Xverse Wallet (supports Taproot)\n\n' +
          'See the console for more information.'
        )
      }

      console.log('Taproot address:', taprootAccount.address)
      console.log('Expected network from env:', import.meta.env.VITE_BITCOIN_NETWORK)

      // Validate network - check if address matches expected network
      const expectedNetwork = import.meta.env.VITE_BITCOIN_NETWORK || 'testnet4'
      const addressNetwork = this.detectAddressNetwork(taprootAccount.address)

      console.log('Detected network from address:', addressNetwork)
      console.log('Expected network:', expectedNetwork)

      if (addressNetwork !== expectedNetwork) {
        const networkName = expectedNetwork === 'testnet4' ? 'Bitcoin Testnet4' : 'Bitcoin Mainnet'
        const walletNetworkName = addressNetwork === 'testnet4' ? 'Bitcoin Testnet' : 'Bitcoin Mainnet'
        throw new WalletError(
          `Network mismatch detected!\n\nThis app is configured for ${networkName}, but your Leather wallet is connected to ${walletNetworkName}.\n\nPlease switch your wallet network:\n1. Click the Leather extension icon\n2. Click the network selector (top right)\n3. Select "${expectedNetwork === 'testnet4' ? 'Testnet' : 'Mainnet'}"\n4. Reconnect your wallet`
        )
      }

      console.log('Network validation passed!')

      // Get UTXOs for the Taproot address (non-blocking)
      let utxos: UTXO[] = []
      let balance = 0

      try {
        utxos = await this.getUTXOs(taprootAccount.address)
        balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
      } catch (error: any) {
        // UTXO fetching failed - log but don't block wallet connection
        console.warn('Failed to fetch UTXOs (will fetch later when needed):', error.message)
        // Continue with empty UTXOs - they'll be fetched when creating a vault
      }

      this.walletState = {
        connected: true,
        address: taprootAccount.address,
        publicKey: taprootAccount.publicKey,
        balance,
        utxos,
      }

      return this.walletState
    } catch (error: any) {
      if (error instanceof WalletError) {
        throw error
      }
      throw new WalletError(`Failed to connect wallet: ${error.message}`, error)
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.provider = null
    this.walletState = null
  }

  /**
   * Get current wallet state
   */
  getWalletState(): WalletState | null {
    return this.walletState
  }

  /**
   * Get UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    try {
      if (!this.provider) {
        this.provider = this.getProvider()
      }

      // Note: Leather wallet may not directly provide UTXO query
      // For MVP, we'll use a Bitcoin RPC or public API
      // This is a placeholder that should be replaced with actual implementation

      const network = import.meta.env.VITE_BITCOIN_NETWORK || 'testnet4'
      const explorerUrl =
        network === 'testnet4'
          ? 'https://mempool.space/testnet4/api'
          : 'https://mempool.space/api'

      const response = await fetch(`${explorerUrl}/address/${address}/utxo`)

      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.statusText}`)
      }

      const utxos = await response.json()

      return utxos.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubKey: '', // Will be fetched when needed
        address,
      }))
    } catch (error: any) {
      throw new WalletError(`Failed to fetch UTXOs: ${error.message}`, error)
    }
  }

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   */
  async signPSBT(psbtHex: string): Promise<string> {
    try {
      if (!this.provider) {
        throw new WalletError('Wallet not connected')
      }

      const response = await this.provider.request('signPsbt', {
        hex: psbtHex,
        signAtIndex: 0,
      })

      if (!response || !response.result || !response.result.hex) {
        throw new WalletError('Failed to sign transaction')
      }

      return response.result.hex
    } catch (error: any) {
      if (error instanceof WalletError) {
        throw error
      }
      throw new WalletError(`Failed to sign PSBT: ${error.message}`, error)
    }
  }

  /**
   * Sign a raw transaction hex
   */
  async signTransaction(txHex: string): Promise<string> {
    try {
      if (!this.provider) {
        throw new WalletError('Wallet not connected')
      }

      // Leather uses PSBT for signing
      // If we receive a raw tx hex, we need to convert it to PSBT first
      // For now, we'll assume the caller provides PSBT hex
      return await this.signPSBT(txHex)
    } catch (error: any) {
      if (error instanceof WalletError) {
        throw error
      }
      throw new WalletError(`Failed to sign transaction: ${error.message}`, error)
    }
  }

  /**
   * Get current block height
   */
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const network = import.meta.env.VITE_BITCOIN_NETWORK || 'testnet4'
      const explorerUrl =
        network === 'testnet4'
          ? 'https://mempool.space/testnet4/api'
          : 'https://mempool.space/api'

      const response = await fetch(`${explorerUrl}/blocks/tip/height`)

      if (!response.ok) {
        throw new Error(`Failed to fetch block height: ${response.statusText}`)
      }

      const height = await response.text()
      return parseInt(height, 10)
    } catch (error: any) {
      throw new WalletError(`Failed to get block height: ${error.message}`, error)
    }
  }

  /**
   * Refresh wallet state (balance and UTXOs)
   */
  async refresh(): Promise<WalletState> {
    if (!this.walletState) {
      throw new WalletError('Wallet not connected')
    }

    const utxos = await this.getUTXOs(this.walletState.address)
    const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0)

    this.walletState = {
      ...this.walletState,
      balance,
      utxos,
    }

    return this.walletState
  }
}

// Export singleton instance
export const leatherWallet = new LeatherWalletService()
export default leatherWallet
