import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Copy,
  Lock,
  Clock,
  Users,
  ExternalLink,
  Edit,
  CheckCircle,
  Calendar,
  TrendingUp,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { vaultParams, bitcoinClient } from '../services'

interface VaultData {
  id: string
  name: string
  status: string
  lockedBTC: number
  unlockDate: string
  beneficiaries: Array<{ address: string; percentage: number }>
  createdAt: string
  createdBlock: number
  unlockBlock: number
  progress: number
  transactions: Array<{ type: string; date: string; txHash: string; block: number }>
}

export default function VaultDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [vault, setVault] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const btcPrice = 0

  useEffect(() => {
    const fetchVaultData = async () => {
      if (!id) {
        setError('No vault ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Get vault parameters from localStorage
        const params = vaultParams.getParams(id)

        if (!params) {
          setError('Vault not found. This vault may have been created in a different session or browser.')
          setLoading(false)
          return
        }

        // Get current block height to calculate progress
        const currentBlock = await bitcoinClient.getCurrentBlockHeight()
        const createdBlock = currentBlock // Approximate, would need to fetch actual TX
        const unlockBlock = createdBlock + params.triggerDelayBlocks
        const blocksElapsed = Math.max(0, currentBlock - createdBlock)
        const progress = Math.min(100, Math.round((blocksElapsed / params.triggerDelayBlocks) * 100))

        // Calculate unlock date (approximation: 10 min per block)
        const blocksRemaining = Math.max(0, unlockBlock - currentBlock)
        const minutesRemaining = blocksRemaining * 10
        const unlockDate = new Date(Date.now() + minutesRemaining * 60 * 1000).toISOString()

        setVault({
          id,
          name: params.name,
          status: progress >= 100 ? 'Unlocked' : 'Active',
          lockedBTC: params.amount / 100000000, // Convert sats to BTC
          unlockDate,
          beneficiaries: params.beneficiaries,
          createdAt: params.createdAt,
          createdBlock,
          unlockBlock,
          progress,
          transactions: [
            {
              type: 'Vault Created',
              date: params.createdAt,
              txHash: id.split(':')[0],
              block: createdBlock
            }
          ]
        })
      } catch (err: any) {
        console.error('Failed to fetch vault data:', err)
        setError(err.message || 'Failed to fetch vault data')
      } finally {
        setLoading(false)
      }
    }

    fetchVaultData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent-teal animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading vault details...</p>
        </div>
      </div>
    )
  }

  if (error || !vault) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="glass-card p-8 text-center">
            <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Error</h2>
            <p className="text-text-secondary mb-6">{error || 'Vault not found'}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-accent-teal rounded-xl font-semibold text-white hover:shadow-glow-teal transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const daysRemaining = Math.ceil(
    (new Date(vault.unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/dashboard">
                <button className="glass-card-hover p-2 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </a>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-display font-bold">{vault.name}</h1>
                  <span className={
                    vault.status === 'Active'
                      ? 'status-active'
                      : vault.status === 'Unlocked'
                      ? 'status-pending'
                      : 'status-completed'
                  }>
                    {vault.status}
                  </span>
                </div>
                <p className="text-sm text-text-muted mt-1">
                  Created {new Date(vault.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="glass-card-hover px-4 py-2 text-sm font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Explorer
              </button>
              {vault.status === 'Active' && (
                <a href="/vault/1/beneficiaries">
                  <button className="px-4 py-2 bg-accent-teal rounded-lg text-sm font-semibold text-white flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                </a>
              )}
              {vault.status === 'Unlocked' && (
                <a href="/vault/1/distribute">
                  <button className="px-6 py-2 bg-accent-amber rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-glow-amber">
                    <Zap className="w-4 h-4" />
                    Trigger Distribution
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Vault ID */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass-card p-4 mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm text-text-muted">Vault ID</div>
              <code className="font-mono text-sm text-text-secondary">{vault.id}</code>
            </div>
            <button
              onClick={() => copyToClipboard(vault.id)}
              className="glass-card-hover px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Overview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          {/* Total Locked */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-teal/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-accent-teal" />
              </div>
              <h3 className="text-sm font-semibold text-text-secondary">Total Locked</h3>
            </div>
            <div className="text-3xl font-display font-bold mb-1">
              {vault.lockedBTC} BTC
            </div>
            <div className="text-text-muted">
              ≈ ${(vault.lockedBTC * btcPrice).toLocaleString('en-US')} USD
            </div>
          </div>

          {/* Unlock Progress */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-amber/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent-amber" />
              </div>
              <h3 className="text-sm font-semibold text-text-secondary">Unlock Progress</h3>
            </div>
            <div className="text-3xl font-display font-bold mb-2">{vault.progress}%</div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-accent-amber rounded-full transition-all duration-1000"
                style={{ width: `${vault.progress}%` }}
              />
            </div>
            <div className="text-sm text-text-muted">{daysRemaining} days remaining</div>
          </div>

          {/* Beneficiaries */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-purple/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent-purple" />
              </div>
              <h3 className="text-sm font-semibold text-text-secondary">Beneficiaries</h3>
            </div>
            <div className="text-3xl font-display font-bold mb-1">
              {vault.beneficiaries.length}
            </div>
            <div className="text-text-muted">100% allocated</div>
          </div>
        </motion.div>

        {/* Unlock Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="glass-card p-8 mb-8"
        >
          <h3 className="text-xl font-display font-bold mb-6">Unlock Timeline</h3>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-white/10">
              <div
                className="h-full bg-accent-teal transition-all duration-1000"
                style={{ width: `${vault.progress}%` }}
              />
            </div>

            {/* Timeline Points */}
            <div className="relative flex items-start justify-between">
              {/* Created */}
              <div className="flex flex-col items-center max-w-[150px]">
                <div className="w-12 h-12 rounded-full bg-accent-teal border-4 border-bg-primary flex items-center justify-center mb-3">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold mb-1">Created</div>
                  <div className="text-xs text-text-muted">
                    {new Date(vault.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-text-muted">Block {vault.createdBlock.toLocaleString()}</div>
                </div>
              </div>

              {/* Current Progress */}
              <div className="flex flex-col items-center max-w-[150px]">
                <div className="w-12 h-12 rounded-full bg-accent-amber border-4 border-bg-primary flex items-center justify-center mb-3 animate-pulse">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold mb-1">Current</div>
                  <div className="text-xs text-accent-amber font-semibold">{vault.progress}% Complete</div>
                  <div className="text-xs text-text-muted">{daysRemaining} days left</div>
                </div>
              </div>

              {/* Unlock */}
              <div className="flex flex-col items-center max-w-[150px]">
                <div className="w-12 h-12 rounded-full bg-white/10 border-4 border-bg-primary flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-text-muted" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold mb-1">Unlock</div>
                  <div className="text-xs text-text-muted">
                    {new Date(vault.unlockDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-text-muted">Block {vault.unlockBlock.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-accent-teal/10 border border-accent-teal/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent-teal flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p className="font-semibold text-text-primary mb-1">Distribution Timing</p>
                <p>
                  Once the unlock date is reached, any beneficiary can trigger the distribution.
                  The Bitcoin will be automatically distributed to all beneficiaries according to their allocations.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Beneficiaries Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="glass-card p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-display font-bold">Beneficiaries</h3>
            {vault.status === 'Active' && (
              <a href="/vault/1/beneficiaries">
                <button className="glass-card-hover px-4 py-2 text-sm font-medium flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </a>
            )}
          </div>

          <div className="space-y-3">
            {vault.beneficiaries.map((beneficiary, index) => (
              <div key={index} className="glass-card p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Address Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-muted mb-1">Beneficiary {index + 1}</div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-text-secondary truncate">
                        {beneficiary.address}
                      </code>
                      <button
                        onClick={() => copyToClipboard(beneficiary.address)}
                        className="flex-shrink-0 p-1 hover:bg-white/5 rounded transition-colors"
                      >
                        <Copy className="w-4 h-4 text-text-muted" />
                      </button>
                    </div>
                  </div>

                  {/* Right: Allocation */}
                  <div className="flex items-center gap-8">
                    {/* Percentage */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent-amber">
                        {beneficiary.percentage}%
                      </div>
                      <div className="text-xs text-text-muted">Allocation</div>
                    </div>

                    {/* Amount */}
                    <div className="text-right min-w-[120px]">
                      <div className="text-lg font-semibold">
                        {((vault.lockedBTC * beneficiary.percentage) / 100).toFixed(4)} BTC
                      </div>
                      <div className="text-sm text-text-muted">
                        ≈ ${((vault.lockedBTC * beneficiary.percentage * btcPrice) / 100).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-amber rounded-full"
                      style={{ width: `${beneficiary.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-card p-8"
        >
          <h3 className="text-xl font-display font-bold mb-6">Transaction History</h3>

          <div className="space-y-4">
            {vault.transactions.map((tx, index) => (
              <div key={index} className="flex items-start gap-4 p-4 glass-card">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-teal/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-accent-teal" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{tx.type}</h4>
                    <span className="text-xs text-text-muted">
                      {new Date(tx.date).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-text-muted truncate">
                      {tx.txHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(tx.txHash)}
                      className="flex-shrink-0 p-1 hover:bg-white/5 rounded transition-colors"
                    >
                      <Copy className="w-3 h-3 text-text-muted" />
                    </button>
                  </div>
                  <div className="text-xs text-text-muted mt-1">Block {tx.block.toLocaleString()}</div>
                </div>

                <a
                  href="#"
                  className="flex-shrink-0 text-accent-teal hover:text-accent-teal/80 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
