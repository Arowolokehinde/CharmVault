import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Zap,
  Users,
  ExternalLink,
  Copy,
  Lock,
  ArrowRight
} from 'lucide-react'

export default function DistributeVault() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [copied, setCopied] = useState(false)

  // TODO: Replace with real vault data from Charms SDK
  const mockVault: {
    id: string
    type: string
    lockedBTC: number
    beneficiaries: Array<{ name: string; address: string; percentage: number }>
    networkFee: number
  } = {
    id: '',
    type: 'Trust Fund',
    lockedBTC: 0,
    beneficiaries: [],
    networkFee: 0,
  }
  const btcPrice = 0

  const handleDistribute = () => {
    setIsProcessing(true)
    // Simulate transaction processing
    setTimeout(() => {
      setIsProcessing(false)
      setIsSuccess(true)
      setTxHash('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6')
    }, 4000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Success State
  if (isSuccess) {
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
                <h1 className="text-2xl font-display font-bold text-success">Distribution Complete</h1>
                <p className="text-sm text-text-muted mt-1">Bitcoin distributed successfully</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Success Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-success" />
            </div>
          </motion.div>

          {/* Success Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-display font-bold mb-3">Distribution Successful</h2>
            <p className="text-xl text-text-secondary">
              {mockVault.lockedBTC} BTC has been distributed to {mockVault.beneficiaries.length} beneficiaries
            </p>
          </motion.div>

          {/* Transaction Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-8 mb-8"
          >
            <h3 className="text-xl font-display font-bold mb-6">Transaction Details</h3>

            <div className="space-y-4">
              {/* TX Hash */}
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="text-sm text-text-muted mb-2">Transaction Hash</div>
                <div className="flex items-center justify-between gap-4">
                  <code className="font-mono text-sm text-text-secondary break-all">{txHash}</code>
                  <button
                    onClick={() => copyToClipboard(txHash)}
                    className="flex-shrink-0 glass-card-hover p-2 rounded-lg"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Block */}
              <div className="flex justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-text-muted">Block</span>
                <span className="font-mono">2,861,950</span>
              </div>

              {/* Confirmations */}
              <div className="flex justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-text-muted">Confirmations</span>
                <span className="font-semibold text-success">1</span>
              </div>

              {/* Fee */}
              <div className="flex justify-between p-4 bg-white/5 rounded-xl">
                <span className="text-text-muted">Network Fee</span>
                <span className="font-mono">{mockVault.networkFee} BTC</span>
              </div>
            </div>

            <a
              href="#"
              className="mt-6 w-full px-6 py-3 glass-card-hover rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              View on Explorer
            </a>
          </motion.div>

          {/* Distribution Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-8 mb-8"
          >
            <h3 className="text-xl font-display font-bold mb-6">Distribution Summary</h3>

            <div className="space-y-3">
              {mockVault.beneficiaries.map((beneficiary, index) => (
                <div key={index} className="p-4 bg-success/5 border border-success/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="font-semibold">{beneficiary.name}</span>
                    </div>
                    <span className="font-mono font-bold">
                      {((mockVault.lockedBTC * beneficiary.percentage) / 100).toFixed(4)} BTC
                    </span>
                  </div>
                  <div className="text-xs font-mono text-text-muted truncate ml-7">
                    {beneficiary.address}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4"
          >
            <a href="/dashboard">
              <button className="px-8 py-3 glass-card-hover rounded-xl font-semibold">
                Back to Dashboard
              </button>
            </a>
            <a href="/vault/1">
              <button className="px-8 py-3 bg-accent-teal rounded-xl font-semibold text-white shadow-glow-teal hover:shadow-xl transition-all">
                View Vault Details
              </button>
            </a>
          </motion.div>
        </div>
      </div>
    )
  }

  // Main Distribution Flow
  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <a href="/vault/1">
              <button className="glass-card-hover p-2 rounded-lg" disabled={isProcessing}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </a>
            <div>
              <h1 className="text-2xl font-display font-bold">Trigger Distribution</h1>
              <p className="text-sm text-text-muted mt-1">Final step to distribute Bitcoin</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Warning Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-danger/10 border-2 border-danger/30 rounded-xl mb-8"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-7 h-7 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xl font-bold text-danger mb-2">This Action is Irreversible</h3>
              <p className="text-text-secondary leading-relaxed">
                Once you confirm, the Bitcoin will be immediately and permanently distributed to all
                beneficiaries. This transaction cannot be cancelled, reversed, or undone. The vault
                will be closed forever.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 mb-8"
        >
          <h3 className="text-xl font-display font-bold mb-6">Distribution Summary</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total BTC */}
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="text-sm text-text-muted mb-1">Total Amount</div>
              <div className="text-2xl font-display font-bold">{mockVault.lockedBTC} BTC</div>
              <div className="text-sm text-text-muted mt-1">
                ≈ ${(mockVault.lockedBTC * btcPrice).toLocaleString()}
              </div>
            </div>

            {/* Beneficiaries */}
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="text-sm text-text-muted mb-1">Beneficiaries</div>
              <div className="text-2xl font-display font-bold flex items-center justify-center gap-2">
                <Users className="w-6 h-6" />
                {mockVault.beneficiaries.length}
              </div>
              <div className="text-sm text-text-muted mt-1">Recipients</div>
            </div>

            {/* Network Fee */}
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="text-sm text-text-muted mb-1">Network Fee</div>
              <div className="text-2xl font-display font-bold">{mockVault.networkFee} BTC</div>
              <div className="text-sm text-text-muted mt-1">
                ≈ ${(mockVault.networkFee * btcPrice).toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Distribution Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8 mb-8"
        >
          <h3 className="text-xl font-display font-bold mb-6">Recipients</h3>

          <div className="space-y-4">
            {mockVault.beneficiaries.map((beneficiary, index) => (
              <div
                key={index}
                className="p-5 bg-white/5 border border-white/10 rounded-xl hover:border-accent-amber/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Beneficiary Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold mb-1">{beneficiary.name}</div>
                    <code className="text-sm font-mono text-text-muted break-all">
                      {beneficiary.address}
                    </code>
                  </div>

                  {/* Right: Amount */}
                  <div className="text-right lg:min-w-[200px]">
                    <div className="text-sm text-text-muted mb-1">{beneficiary.percentage}%</div>
                    <div className="text-2xl font-bold text-accent-amber">
                      {((mockVault.lockedBTC * beneficiary.percentage) / 100).toFixed(4)} BTC
                    </div>
                    <div className="text-sm text-text-muted">
                      ≈ $
                      {(
                        (mockVault.lockedBTC * beneficiary.percentage * btcPrice) /
                        100
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Total Distribution</span>
              <div className="text-right">
                <div className="text-3xl font-display font-bold text-accent-amber">
                  {mockVault.lockedBTC} BTC
                </div>
                <div className="text-text-muted">
                  + {mockVault.networkFee} BTC network fee
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Transaction Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-8"
        >
          <h4 className="font-semibold mb-4">Transaction Requirements</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Network</span>
              <span>Bitcoin Testnet4</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Outputs</span>
              <span>{mockVault.beneficiaries.length} beneficiaries</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Requires</span>
              <span className="font-semibold">Wallet Signature</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Estimated Confirmation</span>
              <span>~10 minutes</span>
            </div>
          </div>
        </motion.div>

        {/* Final Warning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 bg-warning/10 border border-warning/30 rounded-xl mb-8"
        >
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-semibold text-text-primary mb-1">Final Confirmation</p>
              <p>
                By clicking "Confirm & Distribute", you acknowledge that this action is permanent
                and cannot be reversed. The vault will be closed and all Bitcoin will be sent to
                the beneficiaries.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between"
        >
          <a href="/vault/1">
            <button
              disabled={isProcessing}
              className="glass-card-hover px-8 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </a>

          <button
            onClick={handleDistribute}
            disabled={isProcessing}
            className="px-10 py-4 bg-accent-amber rounded-xl font-bold text-white text-lg shadow-glow-amber hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-3"
          >
            {isProcessing ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Processing Transaction...
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Confirm & Distribute
                <ArrowRight className="w-6 h-6" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
