import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Lock,
  Clock,
  Users,
  TrendingUp,
  Plus,
  Filter,
  ArrowRight,
  Calendar,
  Bitcoin,
  Wallet
} from 'lucide-react'
import { leatherWallet, unisatWallet, vaultService } from '../services'
import type { Vault, WalletState } from '../types/charms'

export default function Dashboard() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'unlocked' | 'distributed'>('all')
  const [walletState, setWalletState] = useState<WalletState | null>(null)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [activeWallet, setActiveWallet] = useState<'unisat' | 'leather' | null>(null)

  // Route protection: Check if wallet is connected, redirect if not
  useEffect(() => {
    const initializeDashboard = async () => {
      // Check both wallet services
      const leatherState = leatherWallet.getWalletState()
      const unisatState = unisatWallet.getWalletState()

      if (leatherState) {
        setActiveWallet('leather')
        // Refresh balance
        try {
          const refreshedState = await leatherWallet.refresh()
          setWalletState(refreshedState)
        } catch (err) {
          console.warn('Failed to refresh balance:', err)
          setWalletState(leatherState)
        }
        loadVaults()
      } else if (unisatState) {
        setActiveWallet('unisat')
        // Refresh balance
        try {
          const refreshedState = await unisatWallet.refresh()
          setWalletState(refreshedState)
        } catch (err) {
          console.warn('Failed to refresh balance:', err)
          setWalletState(unisatState)
        }
        loadVaults()
      } else {
        // No wallet connected, redirect to landing page
        navigate('/')
      }
    }

    initializeDashboard()
  }, [navigate])

  const loadVaults = () => {
    try {
      const allVaults = vaultService.getAllVaults()
      setVaults(allVaults)
    } catch (err: any) {
      console.error('Failed to load vaults:', err)
    }
  }

  const handleDisconnectWallet = () => {
    // Disconnect from the active wallet
    if (activeWallet === 'leather') {
      leatherWallet.disconnect()
    } else if (activeWallet === 'unisat') {
      unisatWallet.disconnect()
    }
    setWalletState(null)
    setActiveWallet(null)
    // Redirect to landing page after disconnect
    navigate('/')
  }

  const filteredVaults = vaults.filter(vault => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'unlocked') {
      // Check if vault is unlocked (deadline passed) but not distributed
      return vault.status === 'Active' && Date.now() >= new Date(vault.unlockDate).getTime()
    }
    return vault.status.toLowerCase() === filterStatus.toLowerCase()
  })

  const totalBTC = vaults.reduce((sum, vault) => sum + vault.lockedBTC, 0)
  const activeVaults = vaults.filter(v => v.status === 'Active').length
  const totalBeneficiaries = vaults.reduce((sum, v) => sum + v.beneficiaries.length, 0)

  // Calculate next unlock
  const nextUnlock = vaults
    .filter(v => v.status === 'Active')
    .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime())[0]

  const daysToNextUnlock = nextUnlock
    ? Math.ceil((new Date(nextUnlock.unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text">CharmVault</h1>
              <p className="text-sm text-text-muted mt-1">Programmable Bitcoin Vaults</p>
            </div>

            <div className="flex items-center gap-4">
              {walletState && (
                <div className="glass-card px-4 py-2 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <Wallet className="w-4 h-4 text-text-secondary" />
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-text-secondary">
                      {walletState.address.substring(0, 8)}...{walletState.address.substring(walletState.address.length - 6)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {(walletState.balance / 100000000).toFixed(4)} BTC
                    </span>
                  </div>
                  <button
                    onClick={handleDisconnectWallet}
                    className="text-xs text-text-muted hover:text-danger transition-colors ml-2"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/save')}
                  className="px-6 py-3 glass-card-hover rounded-xl font-semibold text-white flex items-center gap-2 border-2 border-accent-amber/50 hover:border-accent-amber transition-all"
                >
                  <Wallet className="w-5 h-5 text-accent-amber" />
                  Savings
                </button>
                <button
                  onClick={() => navigate('/create')}
                  className="px-6 py-3 bg-accent-teal rounded-xl font-semibold text-white shadow-glow-teal hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Automation
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          {/* Total BTC Locked */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-accent-teal" />
              </div>
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div className="text-3xl font-display font-bold mb-1">
              {totalBTC.toFixed(4)} <span className="text-xl text-text-muted">BTC</span>
            </div>
            <div className="text-sm text-text-secondary">Total Locked</div>
            <div className="text-xs text-text-muted mt-2">Across {vaults.length} vault{vaults.length !== 1 ? 's' : ''}</div>
          </div>

          {/* Active Vaults */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-amber/20 flex items-center justify-center">
                <Bitcoin className="w-6 h-6 text-accent-amber" />
              </div>
            </div>
            <div className="text-3xl font-display font-bold mb-1">{activeVaults}</div>
            <div className="text-sm text-text-secondary">Active Vaults</div>
            <div className="text-xs text-text-muted mt-2">
              {vaults.length} total vault{vaults.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Total Beneficiaries */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent-purple" />
              </div>
            </div>
            <div className="text-3xl font-display font-bold mb-1">
              {totalBeneficiaries}
            </div>
            <div className="text-sm text-text-secondary">Total Beneficiaries</div>
            <div className="text-xs text-text-muted mt-2">Across all vaults</div>
          </div>

          {/* Next Unlock */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent-teal" />
              </div>
            </div>
            <div className="text-3xl font-display font-bold mb-1">
              {daysToNextUnlock !== null ? daysToNextUnlock : '-'}
            </div>
            <div className="text-sm text-text-secondary">Days to Next Unlock</div>
            <div className="text-xs text-text-muted mt-2">
              {nextUnlock ? nextUnlock.type : 'No active vaults'}
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h2 className="text-2xl font-display font-bold mb-1">Your Vaults</h2>
            <p className="text-sm text-text-secondary">
              Manage and monitor your programmable Bitcoin vaults
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="glass-card-hover px-4 py-2 text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <div className="flex items-center gap-1 glass-card p-1">
              {(['all', 'active', 'unlocked', 'distributed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === status
                      ? 'bg-accent-teal text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Vault List */}
        {filteredVaults.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {filteredVaults.map((vault, index) => (
              <motion.div
                key={vault.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                className="glass-card-hover p-6 group cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left Section */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-accent-teal/20 flex items-center justify-center group-hover:bg-accent-teal/30 transition-colors">
                      <Lock className="w-7 h-7 text-accent-teal" />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-display font-semibold">{vault.type}</h3>
                        <span className={
                          vault.status === 'Active' && Date.now() >= new Date(vault.unlockDate).getTime()
                            ? 'status-pending'
                            : vault.status === 'Active'
                            ? 'status-active'
                            : 'status-completed'
                        }>
                          {vault.status === 'Active' && Date.now() >= new Date(vault.unlockDate).getTime()
                            ? 'Unlocked'
                            : vault.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-secondary">
                        <div className="flex items-center gap-1">
                          <Lock className="w-4 h-4" />
                          <span className="font-mono">{vault.lockedBTC.toFixed(4)} BTC</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{vault.beneficiaries.length} beneficiaries</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Created {new Date(vault.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section - Progress */}
                  <div className="flex-1 lg:max-w-xs">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-text-secondary">Unlock Progress</span>
                      <span className="font-semibold">
                        {Math.min(
                          100,
                          Math.floor(
                            ((Date.now() - new Date(vault.createdAt).getTime()) /
                              (new Date(vault.unlockDate).getTime() - new Date(vault.createdAt).getTime())) *
                              100
                          )
                        )}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            100,
                            Math.floor(
                              ((Date.now() - new Date(vault.createdAt).getTime()) /
                                (new Date(vault.unlockDate).getTime() - new Date(vault.createdAt).getTime())) *
                                100
                            )
                          )}%`
                        }}
                        transition={{ duration: 1, delay: 0.3 + index * 0.1 }}
                        className={`h-full rounded-full ${
                          vault.status === 'Active' && Date.now() >= new Date(vault.unlockDate).getTime()
                            ? 'bg-accent-amber'
                            : vault.status === 'Active'
                            ? 'bg-accent-teal'
                            : 'bg-text-muted'
                        }`}
                      />
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      Unlocks: {new Date(vault.unlockDate).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Right Section - Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/vault/${vault.id}`)}
                      className="glass-card-hover px-4 py-2 text-sm font-medium"
                    >
                      Details
                    </button>
                    {vault.status === 'Active' && Date.now() >= new Date(vault.unlockDate).getTime() && (
                      <button
                        onClick={() => navigate(`/vault/${vault.id}/distribute`)}
                        className="px-4 py-2 bg-accent-amber rounded-lg text-sm font-semibold text-white flex items-center gap-1 hover:shadow-glow-amber transition-all"
                      >
                        Distribute
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="glass-card p-12 text-center"
          >
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-accent-teal/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-accent-teal" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">
                No {filterStatus !== 'all' ? filterStatus : ''} vaults found
              </h3>
              <p className="text-text-secondary mb-8 leading-relaxed">
                {filterStatus === 'all'
                  ? "You haven't created any vaults yet. Start securing your Bitcoin with programmable time-locked distributions."
                  : `You don't have any ${filterStatus} vaults. Try a different filter or create a new vault.`
                }
              </p>
              <button
                onClick={() => navigate('/create')}
                className="px-8 py-4 bg-accent-teal rounded-xl font-semibold text-white shadow-glow-teal hover:shadow-xl transition-all duration-300 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Your First Vault
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
