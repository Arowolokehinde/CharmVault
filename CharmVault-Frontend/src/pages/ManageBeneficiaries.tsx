import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  AlertCircle,
  Users,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  CheckCircle,
  Info,
  Edit
} from 'lucide-react'

interface Beneficiary {
  id: string
  address: string
  name: string
  percentage: number
}

export default function ManageBeneficiaries() {
  // TODO: Replace with real vault data from Charms SDK
  const originalBeneficiaries: Beneficiary[] = []

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(
    JSON.parse(JSON.stringify(originalBeneficiaries))
  )
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const unlockDate = new Date().toISOString()
  const daysUntilUnlock = Math.ceil(
    (new Date(unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
  const hasChanges = JSON.stringify(beneficiaries) !== JSON.stringify(originalBeneficiaries)
  const isValid = totalPercentage === 100 && beneficiaries.every(b => b.address.length > 0)

  const addBeneficiary = () => {
    if (beneficiaries.length < 5) {
      setBeneficiaries([
        ...beneficiaries,
        { id: Date.now().toString(), address: '', name: '', percentage: 0 },
      ])
    }
  }

  const removeBeneficiary = (id: string) => {
    if (beneficiaries.length > 1) {
      setBeneficiaries(beneficiaries.filter(b => b.id !== id))
    }
  }

  const updateBeneficiary = (id: string, field: keyof Beneficiary, value: string | number) => {
    setBeneficiaries(
      beneficiaries.map(b => (b.id === id ? { ...b, [field]: value } : b))
    )
  }

  const handleConfirm = () => {
    setIsProcessing(true)
    // Simulate transaction processing
    setTimeout(() => {
      setIsProcessing(false)
      window.location.href = '/vault/1'
    }, 3000)
  }

  const getChangeSummary = () => {
    const changes: string[] = []

    // Check for removed beneficiaries
    originalBeneficiaries.forEach(orig => {
      if (!beneficiaries.find(b => b.id === orig.id)) {
        changes.push(`Removed ${orig.name || 'Beneficiary'}`)
      }
    })

    // Check for new beneficiaries
    beneficiaries.forEach(ben => {
      if (!originalBeneficiaries.find(b => b.id === ben.id)) {
        changes.push(`Added ${ben.name || 'New Beneficiary'}`)
      }
    })

    // Check for modified beneficiaries
    beneficiaries.forEach(ben => {
      const orig = originalBeneficiaries.find(b => b.id === ben.id)
      if (orig) {
        if (orig.address !== ben.address) {
          changes.push(`Updated ${ben.name || 'Beneficiary'} address`)
        }
        if (orig.percentage !== ben.percentage) {
          changes.push(`Changed ${ben.name || 'Beneficiary'} allocation: ${orig.percentage}% → ${ben.percentage}%`)
        }
      }
    })

    return changes
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen pb-16">
        {/* Header */}
        <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowConfirmation(false)}
                className="glass-card-hover p-2 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-display font-bold">Confirm Changes</h1>
                <p className="text-sm text-text-muted mt-1">Review before updating</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Warning */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-danger/10 border-2 border-danger/30 rounded-xl mb-8"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-danger mb-2">This Action is Irreversible</p>
                <p className="text-text-secondary leading-relaxed">
                  Once confirmed, these changes will be permanently recorded on the Bitcoin blockchain.
                  The transaction cannot be reversed or cancelled.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Changes Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-8 mb-8"
          >
            <h3 className="text-xl font-display font-bold mb-6">Summary of Changes</h3>

            <div className="space-y-4">
              {getChangeSummary().map((change, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-accent-teal/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-accent-teal flex-shrink-0" />
                  <span className="text-text-secondary">{change}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Before vs After */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-8 mb-8"
          >
            <h3 className="text-xl font-display font-bold mb-6">Before vs After</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before */}
              <div>
                <h4 className="text-sm font-semibold text-text-muted mb-4">BEFORE</h4>
                <div className="space-y-2">
                  {originalBeneficiaries.map(ben => (
                    <div key={ben.id} className="p-3 bg-white/5 rounded-lg">
                      <div className="text-sm font-semibold mb-1">{ben.name}</div>
                      <div className="text-xs font-mono text-text-muted truncate">{ben.address}</div>
                      <div className="text-lg font-bold text-accent-amber mt-1">{ben.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* After */}
              <div>
                <h4 className="text-sm font-semibold text-text-muted mb-4">AFTER</h4>
                <div className="space-y-2">
                  {beneficiaries.map(ben => (
                    <div key={ben.id} className="p-3 bg-accent-teal/10 border border-accent-teal/30 rounded-lg">
                      <div className="text-sm font-semibold mb-1">{ben.name}</div>
                      <div className="text-xs font-mono text-text-muted truncate">{ben.address}</div>
                      <div className="text-lg font-bold text-accent-teal mt-1">{ben.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Transaction Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6 mb-8"
          >
            <h4 className="font-semibold mb-4">Transaction Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Network</span>
                <span>Bitcoin Testnet4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Estimated Fee</span>
                <span className="font-mono">~1,200 sats</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Requires</span>
                <span>Wallet Signature</span>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-between"
          >
            <button
              onClick={() => setShowConfirmation(false)}
              disabled={isProcessing}
              className="glass-card-hover px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-8 py-3 bg-accent-teal rounded-xl font-bold text-white shadow-glow-teal hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm & Sign
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <a href="/vault/1">
              <button className="glass-card-hover p-2 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </a>
            <div>
              <h1 className="text-2xl font-display font-bold">Manage Beneficiaries</h1>
              <p className="text-sm text-text-muted mt-1">Update vault beneficiaries</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-warning/10 border border-warning/30 rounded-xl mb-8"
        >
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-warning mb-2">Time-Sensitive Changes</h3>
              <div className="text-sm text-text-secondary space-y-2">
                <p>
                  This vault unlocks in <span className="font-bold text-warning">{daysUntilUnlock} days</span> on{' '}
                  {new Date(unlockDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="font-semibold text-text-primary">Rules:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Changes require a blockchain transaction</li>
                  <li>You cannot modify beneficiaries after the unlock date</li>
                  <li>All changes are permanent and irreversible</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Beneficiaries Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent-amber/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent-amber" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold">Beneficiaries</h3>
                <p className="text-sm text-text-secondary">Update addresses and allocations</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {beneficiaries.map((beneficiary, index) => (
              <div key={beneficiary.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
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

                <div className="space-y-3">
                  {/* Name */}
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Name (Optional)</label>
                    <input
                      type="text"
                      value={beneficiary.name}
                      onChange={e => updateBeneficiary(beneficiary.id, 'name', e.target.value)}
                      placeholder="e.g., Primary Beneficiary"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-accent-teal transition-all"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Bitcoin Address</label>
                    <input
                      type="text"
                      value={beneficiary.address}
                      onChange={e => updateBeneficiary(beneficiary.id, 'address', e.target.value)}
                      placeholder="tb1q... or bc1q..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg font-mono text-sm focus:outline-none focus:border-accent-teal transition-all"
                    />
                    {beneficiary.address && beneficiary.address.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-success">
                        <CheckCircle className="w-3 h-3" />
                        Valid address format
                      </div>
                    )}
                  </div>

                  {/* Percentage */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs text-text-muted">Allocation</label>
                      <span className="text-lg font-bold text-accent-amber">
                        {beneficiary.percentage}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={beneficiary.percentage}
                      onChange={e =>
                        updateBeneficiary(beneficiary.id, 'percentage', parseInt(e.target.value))
                      }
                      className="w-full accent-accent-amber"
                    />
                  </div>
                </div>
              </div>
            ))}

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
          <div
            className={`p-4 rounded-xl border ${
              totalPercentage === 100
                ? 'bg-success/10 border-success/30'
                : 'bg-danger/10 border-danger/30'
            }`}
          >
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
              <p className="text-sm text-danger mt-2">Percentages must equal exactly 100%</p>
            )}
          </div>
        </motion.div>

        {/* Info Box */}
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 bg-accent-teal/10 border border-accent-teal/30 rounded-xl mb-8"
          >
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-accent-teal flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p className="font-semibold text-text-primary mb-1">Changes Detected</p>
                <p>
                  You've made changes to the beneficiaries. Click "Review Changes" to see a
                  comparison and confirm the update.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <a href="/vault/1">
            <button className="glass-card-hover px-6 py-3 rounded-xl font-semibold">
              Cancel
            </button>
          </a>
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!isValid || !hasChanges}
            className={`px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all ${
              isValid && hasChanges
                ? 'bg-accent-teal shadow-glow-teal hover:shadow-xl'
                : 'opacity-50 cursor-not-allowed bg-white/10'
            }`}
          >
            <Edit className="w-5 h-5" />
            Review Changes
          </button>
        </motion.div>
      </div>
    </div>
  )
}
