import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  Lock,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Wallet,
  Plus,
  Trash2,
  Calendar,
  Info,
  Loader2
} from 'lucide-react'
import { leatherWallet, unisatWallet, vaultService, spellBuilder, vaultParams } from '../services'
import type { WalletState, Beneficiary as CharmsBeneficiary } from '../types/charms'

type Step = 1 | 2 | 3 | 4

interface Beneficiary {
  id: string
  address: string
  percentage: number
}

export default function CreateVault() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [vaultName, setVaultName] = useState('')
  const [amount, setAmount] = useState('')
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { id: '1', address: '', percentage: 50 },
    { id: '2', address: '', percentage: 50 },
  ])
  const [unlockDate, setUnlockDate] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Wallet state
  const [walletState, setWalletState] = useState<WalletState | null>(null)

  // Creation state
  const [isCreating, setIsCreating] = useState(false)
  const [creationStep, setCreationStep] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Route protection: Check if wallet is connected
  useEffect(() => {
    const initializeWallet = async () => {
      // Check both wallet services
      const leatherState = leatherWallet.getWalletState()
      const unisatState = unisatWallet.getWalletState()

      if (leatherState) {
        // Refresh balance
        try {
          const refreshedState = await leatherWallet.refresh()
          setWalletState(refreshedState)
        } catch (err) {
          console.warn('Failed to refresh balance:', err)
          setWalletState(leatherState)
        }
      } else if (unisatState) {
        // Refresh balance
        try {
          const refreshedState = await unisatWallet.refresh()
          setWalletState(refreshedState)
        } catch (err) {
          console.warn('Failed to refresh balance:', err)
          setWalletState(unisatState)
        }
      } else {
        // No wallet connected, redirect to landing page
        navigate('/')
      }
    }

    initializeWallet()
  }, [navigate])

  const balance = walletState ? walletState.balance / 100000000 : 0 // Convert satoshis to BTC
  const btcPrice = 0 // TODO: Fetch from price API
  const estimatedFee = spellBuilder.estimateFee(1, beneficiaries.length + 1, 2.0) / 100000000

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
  const isStep1Valid = amount && parseFloat(amount) > 0 && parseFloat(amount) <= balance
  const isStep2Valid = totalPercentage === 100 && beneficiaries.every(b =>
    b.address.length > 0 && (b.address.startsWith('tb1p') || b.address.startsWith('bc1p'))
  )
  const isStep3Valid = unlockDate !== ''
  const isStep4Valid = confirmed

  const addBeneficiary = () => {
    if (beneficiaries.length < 5) {
      setBeneficiaries([...beneficiaries, { id: Date.now().toString(), address: '', percentage: 0 }])
    }
  }

  const removeBeneficiary = (id: string) => {
    if (beneficiaries.length > 1) {
      setBeneficiaries(beneficiaries.filter(b => b.id !== id))
    }
  }

  const updateBeneficiary = (id: string, field: 'address' | 'percentage', value: string | number) => {
    setBeneficiaries(beneficiaries.map(b =>
      b.id === id ? { ...b, [field]: value } : b
    ))
  }

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep((currentStep + 1) as Step)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return isStep1Valid
      case 2: return isStep2Valid
      case 3: return isStep3Valid
      case 4: return isStep4Valid
      default: return false
    }
  }

  const handleCreateVault = async () => {
    try {
      setIsCreating(true)
      setError(null)

      // Convert BTC to satoshis
      const amountSats = Math.floor(parseFloat(amount) * 100000000)

      // Convert unlock date to blocks
      const daysUntilUnlock = Math.ceil((new Date(unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      const triggerDelayBlocks = daysUntilUnlock * 144 // ~144 blocks per day (10 min blocks)

      // Convert beneficiaries to Charms format
      const charmsBeneficiaries: CharmsBeneficiary[] = beneficiaries.map(b => ({
        address: b.address,
        percentage: b.percentage
      }))

      // Validate beneficiaries
      if (!spellBuilder.validateBeneficiaries(charmsBeneficiaries)) {
        throw new Error('Beneficiary percentages must sum to exactly 100%')
      }

      // Create vault with progress tracking
      setCreationStep('Building transaction...')

      console.log('Creating vault with:', {
        amount: amountSats,
        beneficiaries: charmsBeneficiaries,
        triggerDelayBlocks
      })

      setCreationStep('Generating ZK proof (this may take ~5 minutes)...')

      const vaultTxid = await vaultService.createVault(
        amountSats,
        charmsBeneficiaries,
        triggerDelayBlocks
      )

      // Save vault parameters to localStorage for display on detail page
      const vaultUtxo = `${vaultTxid}:0`
      vaultParams.saveParams(vaultUtxo, {
        name: vaultName.trim() || `Vault ${vaultTxid.substring(0, 8)}`,
        amount: amountSats,
        beneficiaries: charmsBeneficiaries,
        triggerDelayBlocks,
        createdAt: new Date().toISOString(),
        ownerAddress: walletState?.address || '',
        ownerPublicKey: walletState?.publicKey || ''
      })

      setCreationStep('Vault created successfully!')

      // Redirect to vault details
      setTimeout(() => {
        navigate(`/vault/${vaultUtxo}`)
      }, 1500)

    } catch (err: any) {
      console.error('Failed to create vault:', err)
      setError(err.message || 'Failed to create vault')
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
              <h1 className="text-2xl font-display font-bold gradient-text">Create Vault</h1>
              <p className="text-sm text-text-muted mt-1">Secure your Bitcoin with programmable distribution</p>
            </div>
            <div className="glass-card px-4 py-2 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-accent-teal" />
              <span className="text-sm">
                <span className="text-text-muted">Balance:</span>{' '}
                <span className="font-mono font-semibold">{balance.toFixed(8)} BTC</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                      step < currentStep
                        ? 'bg-accent-teal text-white'
                        : step === currentStep
                        ? 'bg-accent-teal text-white shadow-glow-teal'
                        : 'bg-white/5 text-text-muted'
                    }`}
                  >
                    {step < currentStep ? <CheckCircle className="w-6 h-6" /> : step}
                  </div>
                  <div className="text-xs text-text-secondary mt-2 text-center">
                    {step === 1 && 'Amount'}
                    {step === 2 && 'Beneficiaries'}
                    {step === 3 && 'Unlock'}
                    {step === 4 && 'Review'}
                  </div>
                </div>
                {step < 4 && (
                  <div
                    className={`h-0.5 flex-1 transition-all ${
                      step < currentStep ? 'bg-accent-teal' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Lock Amount */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-accent-teal" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Lock Amount</h2>
                  <p className="text-sm text-text-secondary">How much Bitcoin do you want to lock?</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Vault Name Input */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Vault Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    placeholder="e.g., Family Trust, Emergency Fund, Inheritance Vault"
                    maxLength={50}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-teal transition-all"
                  />
                  <p className="text-xs text-text-muted mt-2">
                    Give your vault a memorable name. If left empty, an auto-generated name will be used.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Amount in BTC
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

                {amount && parseFloat(amount) > balance * 0.8 && parseFloat(amount) <= balance && (
                  <div className="flex items-center gap-2 p-4 bg-warning/10 border border-warning/30 rounded-xl text-warning">
                    <Info className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">
                      You're locking most of your balance. Consider keeping some BTC for fees and flexibility.
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Beneficiaries */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent-amber/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent-amber" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Add Beneficiaries</h2>
                  <p className="text-sm text-text-secondary">Who should receive the Bitcoin?</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {beneficiaries.map((beneficiary, index) => (
                  <div key={beneficiary.id} className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-text-secondary">
                        Beneficiary {index + 1}
                      </span>
                      {beneficiaries.length > 1 && (
                        <button
                          onClick={() => removeBeneficiary(beneficiary.id)}
                          className="text-danger hover:text-danger/80 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-text-muted mb-1">
                        Bitcoin Taproot Address (P2TR)
                      </label>
                      <input
                        type="text"
                        value={beneficiary.address}
                        onChange={(e) => updateBeneficiary(beneficiary.id, 'address', e.target.value)}
                        placeholder="tb1p... (testnet) or bc1p... (mainnet)"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg font-mono text-sm focus:outline-none focus:border-accent-teal transition-all"
                      />
                      {beneficiary.address && !beneficiary.address.startsWith('tb1p') && !beneficiary.address.startsWith('bc1p') && (
                        <p className="text-xs text-danger mt-1">
                          ⚠️ Must be a Taproot address (starts with tb1p or bc1p)
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs text-text-muted">Allocation</label>
                        <span className="text-lg font-bold text-accent-amber">{beneficiary.percentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={beneficiary.percentage}
                        onChange={(e) => updateBeneficiary(beneficiary.id, 'percentage', parseInt(e.target.value))}
                        className="w-full accent-accent-amber"
                      />
                      {amount && (
                        <div className="text-xs text-text-muted mt-1">
                          {((parseFloat(amount) * beneficiary.percentage) / 100).toFixed(8)} BTC ≈ $
                          {((parseFloat(amount) * beneficiary.percentage * btcPrice) / 100).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Taproot Address Info */}
                <div className="p-4 bg-accent-teal/10 border border-accent-teal/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-accent-teal flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-text-secondary leading-relaxed">
                      <strong className="text-accent-teal">Taproot Addresses Required:</strong> CharmVault uses Charms Protocol which requires Taproot (P2TR) addresses. Beneficiary addresses must start with <code className="px-1 py-0.5 bg-white/10 rounded">tb1p</code> (testnet) or <code className="px-1 py-0.5 bg-white/10 rounded">bc1p</code> (mainnet).
                    </div>
                  </div>
                </div>

                {beneficiaries.length < 5 && (
                  <button
                    onClick={addBeneficiary}
                    className="w-full py-3 glass-card-hover rounded-xl flex items-center justify-center gap-2 text-accent-teal font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    Add Beneficiary
                  </button>
                )}
              </div>

              {/* Validation Summary */}
              <div className={`p-4 rounded-xl border ${
                totalPercentage === 100
                  ? 'bg-success/10 border-success/30'
                  : 'bg-danger/10 border-danger/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total Allocation</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{totalPercentage}%</span>
                    {totalPercentage === 100 ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-danger" />
                    )}
                  </div>
                </div>
                {totalPercentage !== 100 && (
                  <p className="text-sm text-danger mt-2">
                    Percentages must equal exactly 100%
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Unlock Conditions */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-accent-purple" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Set Unlock Conditions</h2>
                  <p className="text-sm text-text-secondary">When should the vault unlock?</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Unlock Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="date"
                      value={unlockDate}
                      onChange={(e) => setUnlockDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent-teal transition-all"
                    />
                  </div>
                </div>

                {unlockDate && (
                  <div className="glass-card p-6 space-y-4">
                    <h3 className="font-semibold">Unlock Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Unlock Date</span>
                        <span className="font-semibold">
                          {new Date(unlockDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Time Until Unlock</span>
                        <span className="font-semibold">
                          {Math.ceil((new Date(unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Estimated Block Height</span>
                        <span className="font-mono text-text-muted">~2,850,000</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Once the unlock date is reached, any beneficiary can trigger the distribution.
                        The Bitcoin will be automatically sent to all beneficiaries according to their allocations.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 p-4 bg-accent-purple/10 border border-accent-purple/30 rounded-xl">
                  <Info className="w-5 h-5 text-accent-purple flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-text-secondary">
                    <p className="font-semibold text-text-primary mb-1">Note about unlock timing</p>
                    <p>
                      The vault will unlock based on Bitcoin block height, which is approximately
                      equivalent to your selected date. Actual unlock time may vary by a few hours.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Review & Confirm */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-accent-teal" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Review & Confirm</h2>
                  <p className="text-sm text-text-secondary">Verify all details before creating your vault</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Amount Summary */}
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-5 h-5 text-accent-teal" />
                    <h3 className="font-semibold">Locked Amount</h3>
                  </div>
                  <div className="text-3xl font-display font-bold mb-1">
                    {amount} BTC
                  </div>
                  <div className="text-text-muted">
                    ≈ ${(parseFloat(amount) * btcPrice).toLocaleString('en-US')} USD
                  </div>
                </div>

                {/* Beneficiaries Summary */}
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-accent-amber" />
                    <h3 className="font-semibold">Beneficiaries ({beneficiaries.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {beneficiaries.map((beneficiary, index) => (
                      <div key={beneficiary.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm text-text-muted">Beneficiary {index + 1}</div>
                          <div className="font-mono text-sm truncate">{beneficiary.address}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-accent-amber">{beneficiary.percentage}%</div>
                          <div className="text-xs text-text-muted">
                            {((parseFloat(amount) * beneficiary.percentage) / 100).toFixed(4)} BTC
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unlock Summary */}
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-accent-purple" />
                    <h3 className="font-semibold">Unlock Conditions</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Unlock Date</span>
                      <span className="font-semibold">
                        {new Date(unlockDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Days Until Unlock</span>
                      <span className="font-semibold">
                        {Math.ceil((new Date(unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="p-4 bg-danger/10 border-2 border-danger/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold text-danger mb-2">This Action is Irreversible</p>
                      <p className="text-text-secondary leading-relaxed">
                        Once created, this vault cannot be cancelled or modified. The locked Bitcoin will only be
                        accessible after the unlock date. Make sure all details are correct.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-3 p-4 glass-card cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-accent-teal"
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                    I understand that this vault is non-custodial and irreversible. Once created, the Bitcoin
                    will be locked until the unlock date, and the contract cannot be modified or cancelled.
                  </span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
              currentStep === 1
                ? 'opacity-50 cursor-not-allowed glass-card'
                : 'glass-card-hover'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                canProceed()
                  ? 'bg-accent-teal text-white shadow-glow-teal hover:shadow-xl'
                  : 'opacity-50 cursor-not-allowed glass-card'
              }`}
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleCreateVault}
              disabled={!canProceed() || isCreating}
              className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                canProceed() && !isCreating
                  ? 'bg-accent-teal text-white shadow-glow-teal hover:shadow-xl'
                  : 'opacity-50 cursor-not-allowed glass-card'
              }`}
            >
              <Lock className="w-5 h-5" />
              Create Vault
            </button>
          )}
        </div>
      </div>

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

                <h3 className="text-2xl font-display font-bold mb-2">Creating Vault</h3>
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
