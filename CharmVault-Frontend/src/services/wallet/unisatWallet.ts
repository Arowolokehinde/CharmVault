import { WalletState, UTXO, WalletError } from '../../types/charms'

// Unisat Wallet Provider Interface (injected by browser extension)
interface UnisatProvider {
  requestAccounts: () => Promise<string[]>
  getAccounts: () => Promise<string[]>
  getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>
  getNetwork: () => Promise<string>
  switchNetwork: (network: string) => Promise<void>
  signPsbt: (psbtHex: string, options?: any) => Promise<string>
  pushPsbt: (psbtHex: string) => Promise<string>
  getPublicKey: () => Promise<string>
  on: (event: string, handler: (...args: any[]) => void) => void
  removeListener: (event: string, handler: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    unisat?: UnisatProvider
  }
}

class UnisatWalletService {
  private static STORAGE_KEY = 'charmvault_unisat_wallet_state'
  private provider: UnisatProvider | null = null
  private walletState: WalletState | null = null

  constructor() {
    // Restore wallet state from localStorage on initialization
    this.restoreWalletState()
  }

  /**
   * Restore wallet state from localStorage
   */
  private restoreWalletState(): void {
    try {
      const stored = localStorage.getItem(UnisatWalletService.STORAGE_KEY)
      if (stored) {
        const state = JSON.parse(stored)
        // Verify it's not expired (24 hour expiry)
        const age = Date.now() - (state.connectedAt || 0)
        if (age < 24 * 60 * 60 * 1000) {
          // Remove connectedAt before setting state
          const { connectedAt, ...walletState } = state
          this.walletState = walletState
          console.log('✅ Restored Unisat wallet state from localStorage')
        } else {
          // Expired, clear it
          localStorage.removeItem(UnisatWalletService.STORAGE_KEY)
        }
      }
    } catch (error) {
      console.warn('Failed to restore Unisat wallet state:', error)
      localStorage.removeItem(UnisatWalletService.STORAGE_KEY)
    }
  }

  /**
   * Save wallet state to localStorage
   */
  private saveWalletState(): void {
    if (this.walletState) {
      try {
        localStorage.setItem(
          UnisatWalletService.STORAGE_KEY,
          JSON.stringify({
            ...this.walletState,
            connectedAt: Date.now()
          })
        )
        console.log('💾 Saved Unisat wallet state to localStorage')
      } catch (error) {
        console.warn('Failed to save Unisat wallet state:', error)
      }
    }
  }

  /**
   * Check if Unisat wallet is installed
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.unisat
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
      return 'livenet'
    } else if (address.startsWith('tb1p') || address.startsWith('tb1q')) {
      return 'testnet'
    }
    throw new WalletError(`Unknown address format: ${address}`)
  }

  /**
   * Get the wallet provider
   */
  private getProvider(): UnisatProvider {
    if (typeof window === 'undefined') {
      throw new WalletError('Window object not available')
    }

    const provider = window.unisat
    if (!provider) {
      throw new WalletError(
        'Unisat wallet not installed. Please install from https://unisat.io'
      )
    }

    return provider
  }

  /**
   * Connect to Unisat wallet
   */
  async connect(): Promise<WalletState> {
    try {
      this.provider = this.getProvider()

      // Request account access
      const accounts = await this.provider.requestAccounts()

      if (!accounts || accounts.length === 0) {
        throw new WalletError('No accounts found. Please create a wallet in Unisat.')
      }

      const address = accounts[0]
      console.log('Unisat address:', address)

      // Validate address type - MUST be Taproot (starts with bc1p or tb1p)
      if (!address.startsWith('bc1p') && !address.startsWith('tb1p')) {
        throw new WalletError(
          'Taproot address required!\n\n' +
          'CharmVault requires a Bitcoin Taproot (P2TR) address.\n\n' +
          `Your current address (${address.substring(0, 8)}...) is not a Taproot address.\n\n` +
          'Please:\n' +
          '1. Create a new wallet in Unisat\n' +
          '2. Select "Taproot (P2TR)" as the address type\n' +
          '3. Reconnect to CharmVault'
        )
      }

      console.log('Expected network from env:', import.meta.env.VITE_BITCOIN_NETWORK)

      // Get current network from Unisat
      const unisatNetwork = await this.provider.getNetwork()
      console.log('Unisat network:', unisatNetwork)

      // Validate network - check if address matches expected network
      const expectedNetwork = import.meta.env.VITE_BITCOIN_NETWORK || 'testnet4'
      const addressNetwork = this.detectAddressNetwork(address)

      console.log('Detected network from address:', addressNetwork)
      console.log('Expected network:', expectedNetwork)

      // Map our network names to Unisat's network names
      const expectedUnisatNetwork = expectedNetwork === 'testnet4' ? 'testnet' : 'livenet'

      if (addressNetwork !== expectedUnisatNetwork) {
        const networkName = expectedNetwork === 'testnet4' ? 'Bitcoin Testnet' : 'Bitcoin Mainnet'
        const walletNetworkName = addressNetwork === 'testnet' ? 'Bitcoin Testnet' : 'Bitcoin Mainnet'

        throw new WalletError(
          `Network mismatch detected!\n\nThis app is configured for ${networkName}, but your Unisat wallet is connected to ${walletNetworkName}.\n\nPlease switch your wallet network:\n1. Click the Unisat extension icon\n2. Click the network selector\n3. Select "${expectedNetwork === 'testnet4' ? 'Testnet' : 'Mainnet'}"\n4. Reconnect your wallet`
        )
      }

      console.log('Network validation passed!')

      // Get public key
      let publicKey = ''
      try {
        publicKey = await this.provider.getPublicKey()
        console.log('Public key:', publicKey)
      } catch (error) {
        console.warn('Could not get public key:', error)
      }

      // Get balance
      let balance = 0
      try {
        const balanceInfo = await this.provider.getBalance()
        balance = balanceInfo.confirmed
        console.log('Balance:', balance, 'sats')
      } catch (error) {
        console.warn('Could not get balance:', error)
      }

      // Get UTXOs
      let utxos: UTXO[] = []
      try {
        utxos = await this.getUTXOs(address)
      } catch (error: any) {
        console.warn('Failed to fetch UTXOs (will fetch later when needed):', error.message)
      }

      this.walletState = {
        connected: true,
        address,
        publicKey,
        balance,
        utxos,
      }

      // Save to localStorage
      this.saveWalletState()

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

    // Clear from localStorage
    localStorage.removeItem(UnisatWalletService.STORAGE_KEY)
    console.log('🗑️ Cleared Unisat wallet state from localStorage')
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

      const signedPsbtHex = await this.provider.signPsbt(psbtHex)

      return signedPsbtHex
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

      // Unisat uses PSBT for signing
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

    // Update localStorage
    this.saveWalletState()

    return this.walletState
  }

  /**
   * Switch network
   */
  async switchNetwork(network: 'testnet' | 'livenet'): Promise<void> {
    if (!this.provider) {
      throw new WalletError('Wallet not connected')
    }

    await this.provider.switchNetwork(network)
  }
}

// Export singleton instance
export const unisatWallet = new UnisatWalletService()
export default unisatWallet
