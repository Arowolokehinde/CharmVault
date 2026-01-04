import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Wallet,
  Lock,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react'

interface VaultAllocation {
  vaultId: string
  vaultType: string
  status: 'Active' | 'Unlocked' | 'Distributed'
  allocation: number
  btcAmount: number
  unlockDate: string
  createdDate: string
}

export default function BeneficiaryView() {
  const [address, setAddress] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // TODO: Replace with real data from Charms SDK
  const mockAllocations: VaultAllocation[] = []
  const btcPrice = 0

  const handleSearch = () => {
    setHasSearched(true)
  }

  const handleConnectWallet = () => {
    setIsConnecting(true)
    // TODO: Implement real wallet connection
    setTimeout(() => {
      setAddress('')
      setHasSearched(true)
      setIsConnecting(false)
    }, 1500)
  }

  const totalBTC = mockAllocations.reduce((sum, v) => sum + v.btcAmount, 0)
  const activeVaults = mockAllocations.filter(v => v.status === 'Active').length
  const unlockedVaults = mockAllocations.filter(v => v.status === 'Unlocked').length

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold gradient-text">Beneficiary Lookup</h1>
              <p className="text-sm text-text-muted mt-1">Check your vault allocations</p>
            </div>
            <a href="/dashboard">
              <button className="glass-card-hover px-4 py-2 text-sm font-medium">
                Owner Dashboard
              </button>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 mb-8"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-accent-purple/20 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-accent-purple" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">Find Your Allocations</h2>
            <p className="text-text-secondary">
              Enter your Bitcoin address or connect your wallet to see vaults where you're a beneficiary
            </p>
          </div>

          {/* Search Input */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="tb1q... or bc1q..."
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl font-mono focus:outline-none focus:border-accent-teal transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleSearch}
              disabled={!address || isConnecting}
              className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                address && !isConnecting
                  ? 'bg-accent-teal text-white shadow-glow-teal hover:shadow-xl'
                  : 'opacity-50 cursor-not-allowed glass-card'
              }`}
            >
              <Search className="w-5 h-5" />
              Search Address
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-white/10" />
              <span className="text-sm text-text-muted">or</span>
              <div className="h-px w-8 bg-white/10" />
            </div>

            <button
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="px-8 py-3 glass-card-hover rounded-xl font-semibold flex items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Results */}
        {hasSearched && address && (
          <>
            {mockAllocations.length > 0 ? (
              <>
                {/* Summary Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
                >
                  {/* Total BTC */}
                  <div className="glass-card p-6 text-center">
                    <div className="text-sm text-text-muted mb-2">Total Allocation</div>
                    <div className="text-3xl font-display font-bold mb-1">{totalBTC.toFixed(4)} BTC</div>
                    <div className="text-sm text-text-muted">
                      ≈ ${(totalBTC * btcPrice).toLocaleString()}
                    </div>
                  </div>

                  {/* Active Vaults */}
                  <div className="glass-card p-6 text-center">
                    <div className="text-sm text-text-muted mb-2">Active Vaults</div>
                    <div className="text-3xl font-display font-bold mb-1">{activeVaults}</div>
                    <div className="text-sm text-text-muted">Currently locked</div>
                  </div>

                  {/* Unlocked */}
                  <div className="glass-card p-6 text-center">
                    <div className="text-sm text-text-muted mb-2">Ready to Claim</div>
                    <div className="text-3xl font-display font-bold mb-1 text-accent-amber">
                      {unlockedVaults}
                    </div>
                    <div className="text-sm text-text-muted">Available now</div>
                  </div>
                </motion.div>

                {/* Vault List */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <h3 className="text-xl font-display font-bold mb-4">Your Vault Allocations</h3>

                  {mockAllocations.map((vault, index) => (
                    <motion.div
                      key={vault.vaultId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="glass-card p-6 hover:border-accent-teal/30 transition-all cursor-pointer"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        {/* Left: Vault Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-xl font-display font-semibold">{vault.vaultType}</h4>
                            <span
                              className={
                                vault.status === 'Active'
                                  ? 'status-active'
                                  : vault.status === 'Unlocked'
                                  ? 'status-pending'
                                  : 'status-completed'
                              }
                            >
                              {vault.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-text-secondary">
                              <Lock className="w-4 h-4" />
                              <span>
                                Vault ID:{' '}
                                <span className="font-mono">{vault.vaultId.substring(0, 12)}...</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-text-secondary">
                              <Clock className="w-4 h-4" />
                              <span>
                                {vault.status === 'Distributed'
                                  ? 'Distributed'
                                  : `Unlocks ${new Date(vault.unlockDate).toLocaleDateString()}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Allocation */}
                        <div className="text-center lg:min-w-[160px] px-6 py-4 bg-white/5 rounded-xl">
                          <div className="text-sm text-text-muted mb-1">Your Share</div>
                          <div className="text-3xl font-bold text-accent-teal mb-1">
                            {vault.allocation}%
                          </div>
                          <div className="text-lg font-semibold">{vault.btcAmount} BTC</div>
                          <div className="text-sm text-text-muted">
                            ≈ ${(vault.btcAmount * btcPrice).toLocaleString()}
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-col gap-2 lg:min-w-[140px]">
                          <a href={`/vault/${vault.vaultId}`}>
                            <button className="w-full glass-card-hover px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
                              View Details
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </a>
                          {vault.status === 'Unlocked' && (
                            <a href={`/vault/${vault.vaultId}/distribute`}>
                              <button className="w-full px-4 py-2 bg-accent-amber rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-glow-amber hover:shadow-xl transition-all">
                                <Zap className="w-4 h-4" />
                                Claim Now
                              </button>
                            </a>
                          )}
                          {vault.status === 'Distributed' && (
                            <div className="w-full px-4 py-2 bg-success/20 border border-success/30 rounded-lg text-sm font-medium text-success flex items-center justify-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Claimed
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Info Box */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8 p-4 bg-accent-teal/10 border border-accent-teal/30 rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-accent-teal flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary mb-1">
                        About Beneficiary Access
                      </p>
                      <p>
                        As a beneficiary, you can view vault details and trigger distribution once
                        the unlock date is reached. You cannot modify vault settings or beneficiary
                        allocations.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </>
            ) : (
              /* Empty State */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-12 text-center"
              >
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 rounded-full bg-text-muted/20 flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-text-muted" />
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">No Vaults Found</h3>
                  <p className="text-text-secondary leading-relaxed mb-6">
                    The address <code className="font-mono text-sm px-2 py-1 bg-white/5 rounded">
                      {address.substring(0, 16)}...
                    </code> is not listed as a beneficiary in any CharmVault vaults.
                  </p>
                  <div className="p-4 bg-accent-purple/10 border border-accent-purple/30 rounded-xl text-left">
                    <p className="text-sm text-text-secondary">
                      <span className="font-semibold text-text-primary">Possible reasons:</span>
                    </p>
                    <ul className="text-sm text-text-secondary mt-2 space-y-1 ml-4 list-disc">
                      <li>No vaults have been created with this address as a beneficiary</li>
                      <li>The vault creator hasn't shared the vault details with you yet</li>
                      <li>Double-check the address for typos</li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Initial Help Text */}
        {!hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="inline-grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="p-6 glass-card">
                <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-accent-teal" />
                </div>
                <h4 className="font-semibold mb-2">Check Your Allocations</h4>
                <p className="text-sm text-text-secondary">
                  See all vaults where you're listed as a beneficiary and your allocation percentages
                </p>
              </div>

              <div className="p-6 glass-card">
                <div className="w-12 h-12 rounded-xl bg-accent-amber/20 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-accent-amber" />
                </div>
                <h4 className="font-semibold mb-2">Track Unlock Dates</h4>
                <p className="text-sm text-text-secondary">
                  Monitor when vaults will unlock and become available for distribution
                </p>
              </div>

              <div className="p-6 glass-card">
                <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-accent-purple" />
                </div>
                <h4 className="font-semibold mb-2">Claim When Ready</h4>
                <p className="text-sm text-text-secondary">
                  Trigger distribution once the unlock date is reached and receive your allocation
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
