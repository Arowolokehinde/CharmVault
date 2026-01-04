import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  Lock,
  Info,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight
} from 'lucide-react'
import { leatherWallet, unisatWallet, vaultService, spellBuilder, vaultParams } from '../services'
import type { WalletState, Beneficiary as CharmsBeneficiary } from '../types/charms'

export default function SaveBitcoin() {
  const navigate = useNavigate()

  // Form state
  const [savingsName, setSavingsName] = useState('')
  const [amount, setAmount] = useState('')
  const [lockPeriod, setLockPeriod] = useState<'none' | '30' | '90' | '365' | 'custom'>('none')
  const [customDays, setCustomDays] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Wallet state
  const [walletState, setWalletState] = useState<WalletState | null>(null)

  // Creation state
  const [isCreating, setIsCreating] = useState(false)
  const [creationStep, setCreationStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showWalletSelection, setShowWalletSelection] = useState(false)

  // Check if wallet is connected
  useEffect(() => {
    const initializeWallet = async () => {
      const leatherState = leatherWallet.getWalletState()
      const unisatState = unisatWallet.getWalletState()

      if (leatherState) {
        try {
          const refreshedState = await leatherWallet.refresh()
          setWalletState(refreshedState)
        } catch (err) {
          console.warn('Failed to refresh balance:', err)
          setWalletState(leatherState)
        }
      } else if (unisatState) {
        try {
          const refreshedState = await unisatWallet.refresh()
          setWalletState(refreshedState)
        } catch (err) {
          console.warn('Failed to refresh balance:', err)
          setWalletState(unisatState)
        }
      }
      // Don't redirect - let user connect wallet here
    }

    initializeWallet()
  }, [])

  const balance = walletState ? walletState.balance / 100000000 : 0
  const estimatedFee = spellBuilder.estimateFee(1, 2, 2.0) / 100000000
  const btcPrice = 0 // TODO: Fetch from price API

  const isFormValid = amount && parseFloat(amount) > 0 && parseFloat(amount) <= balance && confirmed

  const handleConnectWallet = async (walletType: 'unisat' | 'leather') => {
    try {
      setIsConnecting(true)
      setError(null)

      const wallet = walletType === 'unisat' ? unisatWallet : leatherWallet
      const state = await wallet.connect()
      setWalletState(state)
      setShowWalletSelection(false)
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
      console.error('Wallet connection error:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const getDaysUntilUnlock = () => {
    if (lockPeriod === 'none') return 0
    if (lockPeriod === 'custom') return parseInt(customDays) || 0
    return parseInt(lockPeriod)
  }

  const handleSave = async () => {
    try {
      setIsCreating(true)
      setError(null)

      // Convert BTC to satoshis
      const amountSats = Math.floor(parseFloat(amount) * 100000000)

      // Calculate trigger delay blocks
      const daysUntilUnlock = getDaysUntilUnlock()
      const triggerDelayBlocks = daysUntilUnlock * 144 // ~144 blocks per day

      // User is sole beneficiary for savings
      const beneficiaries: CharmsBeneficiary[] = [{
        address: walletState!.address,
        percentage: 100
      }]

      setCreationStep('Building savings transaction...')

      setCreationStep('Generating ZK proof (this may take ~5 minutes)...')

      const vaultTxid = await vaultService.createVault(
        amountSats,
        beneficiaries,
        triggerDelayBlocks
      )

      // Save vault parameters with savings indicator
      const vaultUtxo = `${vaultTxid}:0`
      vaultParams.saveParams(vaultUtxo, {
        name: savingsName.trim() || `Savings ${vaultTxid.substring(0, 8)}`,
        amount: amountSats,
        beneficiaries,
        triggerDelayBlocks,
        createdAt: new Date().toISOString(),
        ownerAddress: walletState!.address,
        ownerPublicKey: walletState!.publicKey
      })

      setCreationStep('Savings created successfully!')

      // Redirect to vault details
      setTimeout(() => {
        navigate(`/vault/${vaultUtxo}`)
      }, 1500)

    } catch (err: any) {
      console.error('Failed to create savings:', err)
      setError(err.message || 'Failed to create savings')
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold gradient-text">Save Bitcoin</h1>
              <p className="text-sm text-text-muted mt-1">Secure your BTC for the future</p>
            </div>
            {walletState && (
              <div className="glass-card px-4 py-2 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent-teal" />
                <span className="text-sm">
                  <span className="text-text-muted">Balance:</span>{' '}
                  <span className="font-mono font-semibold">{balance.toFixed(8)} BTC</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Wallet Connection Prompt - Show if no wallet connected */}
        {!walletState ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-accent-teal/20 flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-accent-teal" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-lg text-text-secondary mb-8 max-w-md mx-auto">
              To start saving Bitcoin securely on-chain, you'll need to connect a Bitcoin wallet first.
            </p>
            <button
              onClick={() => setShowWalletSelection(true)}
              disabled={isConnecting}
              className="px-8 py-4 bg-accent-teal rounded-xl font-bold text-lg text-white shadow-glow-teal hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 space-y-8"
          >
          {/* Savings Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Savings Goal Name (Optional)
            </label>
            <input
              type="text"
              value={savingsName}
              onChange={(e) => setSavingsName(e.target.value)}
              placeholder="e.g., Emergency Fund, Future Home, Long-term Stack"
              maxLength={50}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-teal transition-all"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Amount to Save
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.00000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00000000"
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-mono focus:outline-none focus:border-accent-teal transition-all"
              />
              <button
                onClick={() => setAmount(Math.max(0, balance - estimatedFee).toFixed(8))}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-accent-teal font-semibold hover:text-accent-teal/80"
              >
                MAX
              </button>
            </div>
            {amount && (
              <div className="mt-2 text-lg text-text-muted">
                ≈ ${(parseFloat(amount) * btcPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD
              </div>
            )}
          </div>

          {/* Lock Period Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Lock Period (Optional)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: 'none', label: 'No Lock', desc: 'Flexible' },
                { value: '30', label: '30 Days', desc: '1 Month' },
                { value: '90', label: '90 Days', desc: '3 Months' },
                { value: '365', label: '1 Year', desc: '365 Days' },
                { value: 'custom', label: 'Custom', desc: 'Set days' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLockPeriod(option.value as any)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    lockPeriod === option.value
                      ? 'bg-accent-teal/20 border-accent-teal'
                      : 'glass-card border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-sm">{option.label}</div>
                  <div className="text-xs text-text-muted mt-1">{option.desc}</div>
                </button>
              ))}
            </div>

            {lockPeriod === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4"
              >
                <input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Enter number of days"
                  min="1"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-teal transition-all"
                />
              </motion.div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-accent-teal/10 border border-accent-teal/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-accent-teal flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary leading-relaxed">
                {lockPeriod === 'none' ? (
                  <>
                    <strong className="text-accent-teal">No Time-Lock:</strong> You'll be able to withdraw
                    your Bitcoin immediately. Perfect for flexible savings you might need access to.
                  </>
                ) : (
                  <>
                    <strong className="text-accent-teal">Time-Locked Savings:</strong> Your Bitcoin will be
                    locked for {getDaysUntilUnlock()} days. After this period, you can withdraw your savings
                    plus any accumulated value.
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Balance Info */}
          <div className="glass-card p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Available Balance</span>
              <span className="font-mono">{balance.toFixed(8)} BTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Estimated Fee</span>
              <span className="font-mono">{estimatedFee.toFixed(8)} BTC</span>
            </div>
            {amount && (
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="font-semibold">Remaining</span>
                <span className="font-mono font-semibold">
                  {(balance - parseFloat(amount) - estimatedFee).toFixed(8)} BTC
                </span>
              </div>
            )}
          </div>

          {amount && parseFloat(amount) > balance && (
            <div className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">Insufficient balance</span>
            </div>
          )}

          {/* Confirmation */}
          <label className="flex items-start gap-3 p-4 glass-card cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 accent-accent-teal"
            />
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              I understand that this savings is secured on-chain and {lockPeriod !== 'none' ? 'will be locked until the specified date' : 'can be withdrawn at any time'}.
              Transaction fees apply.
            </span>
          </label>

          {/* Action Button */}
          <button
            onClick={handleSave}
            disabled={!isFormValid || isCreating}
            className={`w-full px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              isFormValid && !isCreating
                ? 'bg-accent-teal text-white shadow-glow-teal hover:shadow-xl'
                : 'opacity-50 cursor-not-allowed glass-card'
            }`}
          >
            <Lock className="w-5 h-5" />
            {isCreating ? 'Creating Savings...' : 'Save Bitcoin'}
          </button>
          </motion.div>
        )}
      </div>

      {/* Wallet Selection Modal */}
      {showWalletSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-h3 font-display font-bold">Select Wallet</h3>
              <button
                onClick={() => setShowWalletSelection(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleConnectWallet('unisat')}
                disabled={isConnecting || !unisatWallet.isInstalled()}
                className="w-full glass-card-hover p-4 text-left flex items-start gap-4 disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-6 h-6 text-accent-teal" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Unisat Wallet</div>
                  <div className="text-sm text-text-secondary">Supports Bitcoin Taproot (P2TR) addresses</div>
                  {!unisatWallet.isInstalled() && (
                    <div className="text-xs text-accent-amber mt-2">
                      Not installed - <a href="https://unisat.io" target="_blank" rel="noopener noreferrer" className="underline">Install here</a>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => handleConnectWallet('leather')}
                disabled={isConnecting || !leatherWallet.isInstalled()}
                className="w-full glass-card-hover p-4 text-left flex items-start gap-4 disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-6 h-6 text-accent-teal" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Leather Wallet</div>
                  <div className="text-sm text-text-secondary">Multi-chain Bitcoin wallet</div>
                  {!leatherWallet.isInstalled() && (
                    <div className="text-xs text-accent-amber mt-2">
                      Not installed - <a href="https://leather.io" target="_blank" rel="noopener noreferrer" className="underline">Install here</a>
                    </div>
                  )}
                </div>
              </button>
            </div>

            <div className="mt-6 p-4 bg-accent-teal/10 border border-accent-teal/20 rounded-lg">
              <p className="text-xs text-text-secondary leading-relaxed">
                <strong className="text-accent-teal">Note:</strong> CharmVault requires a Bitcoin Taproot (P2TR) address.
                Unisat wallet is recommended for full compatibility.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Loading Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 max-w-md w-full mx-4"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-accent-teal/20 flex items-center justify-center mb-6">
                  <Loader2 className="w-8 h-8 text-accent-teal animate-spin" />
                </div>

                <h3 className="text-2xl font-display font-bold mb-2">Creating Savings</h3>
                <p className="text-text-secondary mb-6">{creationStep}</p>

                <div className="w-full space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-text-secondary">Building transaction</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      creationStep.includes('proof') ? 'bg-accent-teal' : 'bg-white/10'
                    }`}>
                      {creationStep.includes('proof') ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                      )}
                    </div>
                    <span className="text-text-secondary">
                      Generating ZK proof (~5 minutes)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      creationStep.includes('success') ? 'bg-success' : 'bg-white/10'
                    }`}>
                      {creationStep.includes('success') ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                      )}
                    </div>
                    <span className="text-text-secondary">Broadcasting to network</span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-accent-purple/10 border border-accent-purple/30 rounded-xl">
                  <p className="text-xs text-text-secondary">
                    Please keep this window open. The ZK proof generation takes approximately 5 minutes.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {error && !isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setError(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-danger" />
                </div>

                <h3 className="text-2xl font-display font-bold mb-2">Creation Failed</h3>
                <p className="text-text-secondary mb-6">{error}</p>

                <button
                  onClick={() => setError(null)}
                  className="px-6 py-3 bg-accent-teal rounded-xl font-semibold text-white hover:shadow-glow-teal transition-all"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
