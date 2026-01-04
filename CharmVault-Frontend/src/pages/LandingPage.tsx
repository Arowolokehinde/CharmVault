import { Lock, Clock, Users, Zap, Shield, Code, CheckCircle, ArrowRight, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leatherWallet, unisatWallet } from '../services'
import type { WalletState } from '../types/charms'

type WalletType = 'unisat' | 'leather'

interface WalletOption {
  type: WalletType
  name: string
  description: string
  isInstalled: boolean
  installUrl: string
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletState, setWalletState] = useState<WalletState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWalletSelection, setShowWalletSelection] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null)

  // Get available wallets
  const walletOptions: WalletOption[] = [
    {
      type: 'unisat',
      name: 'Unisat Wallet',
      description: 'Supports Bitcoin Taproot (P2TR) addresses',
      isInstalled: unisatWallet.isInstalled(),
      installUrl: 'https://unisat.io',
    },
    {
      type: 'leather',
      name: 'Leather Wallet',
      description: 'Multi-chain Bitcoin wallet',
      isInstalled: leatherWallet.isInstalled(),
      installUrl: 'https://leather.io',
    },
  ]

  // Check if wallet is already connected on mount
  useEffect(() => {
    const leatherState = leatherWallet.getWalletState()
    const unisatState = unisatWallet.getWalletState()

    if (leatherState) {
      setWalletState(leatherState)
      setSelectedWallet('leather')
    } else if (unisatState) {
      setWalletState(unisatState)
      setSelectedWallet('unisat')
    }
  }, [])

  const handleWalletSelection = (walletType: WalletType) => {
    setSelectedWallet(walletType)
    setShowWalletSelection(false)
    connectWallet(walletType)
  }

  const connectWallet = async (walletType: WalletType) => {
    try {
      setIsConnecting(true)
      setError(null)

      const wallet = walletType === 'unisat' ? unisatWallet : leatherWallet
      const state = await wallet.connect()
      setWalletState(state)
      setSelectedWallet(walletType)

      // Redirect to dashboard after successful connection
      setTimeout(() => {
        navigate('/dashboard')
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
      console.error('Wallet connection error:', err)
      setSelectedWallet(null)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectWallet = () => {
    setShowWalletSelection(true)
  }

  return (
    <div className="min-h-screen">
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
              {walletOptions.map((wallet) => (
                <button
                  key={wallet.type}
                  onClick={() => wallet.isInstalled ? handleWalletSelection(wallet.type) : window.open(wallet.installUrl, '_blank')}
                  disabled={isConnecting}
                  className="w-full glass-card-hover p-4 text-left flex items-start gap-4 disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-6 h-6 text-accent-teal" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">{wallet.name}</div>
                    <div className="text-sm text-text-secondary">{wallet.description}</div>
                    {!wallet.isInstalled && (
                      <div className="text-xs text-accent-amber mt-2">
                        Not installed - Click to install
                      </div>
                    )}
                  </div>
                </button>
              ))}
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

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-48 w-96 h-96 bg-accent-teal/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-accent-purple/20 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-amber/10 rounded-full blur-3xl" />

          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-hero font-display font-bold mb-6">
              <span className="gradient-text">Save Bitcoin.</span> Automate Payments.{' '}
              <span className="gradient-text">Earn Yield.</span>
              <br />
              All in One Platform.
            </h1>

            <p className="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-12 leading-relaxed">
              CharmVault is your all-in-one Bitcoin platform. Lock BTC in programmable vaults,
              save for the future, and earn yield—all without leaving the Bitcoin ecosystem.
              <span className="block mt-2 text-text-muted">
                No custody. No intermediaries. Pure Bitcoin.
              </span>
            </p>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 px-6 py-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm max-w-md mx-auto"
              >
                {error}
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              {!walletState ? (
                <>
                  <button
                    onClick={handleConnectWallet}
                    disabled={isConnecting}
                    className="group relative px-8 py-4 bg-accent-teal rounded-xl font-semibold text-lg text-white shadow-glow-teal hover:shadow-xl transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => navigate('/save')}
                    className="px-8 py-4 glass-card-hover rounded-xl font-semibold text-lg text-text-primary flex items-center gap-2 border-2 border-accent-amber/50 hover:border-accent-amber transition-all"
                  >
                    <Wallet className="w-5 h-5 text-accent-amber" />
                    Start Saving
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="glass-card px-6 py-3 rounded-xl text-sm">
                    <span className="text-text-muted">Connected: </span>
                    <span className="text-accent-teal font-mono">
                      {walletState.address.slice(0, 8)}...{walletState.address.slice(-6)}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="group px-8 py-4 bg-accent-teal rounded-xl font-semibold text-lg text-white shadow-glow-teal hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-8 text-sm text-text-muted">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>Bitcoin Testnet4</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Zero-Knowledge Proofs</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Non-Custodial</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Use Case Cards */}
      <section className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-h1 font-display font-bold mb-4">
              Built for Real Use Cases
            </h2>
            <p className="text-xl text-text-secondary">
              Programmable vaults and savings for every Bitcoin need
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Trust Funds */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-card-hover p-8 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent-teal/20 flex items-center justify-center mb-6 group-hover:bg-accent-teal/30 transition-colors glow-teal">
                <Users className="w-8 h-8 text-accent-teal" />
              </div>
              <h3 className="text-h3 font-display font-semibold mb-3">Trust Funds</h3>
              <p className="text-text-secondary mb-4 leading-relaxed">
                Lock Bitcoin for beneficiaries with scheduled releases at specific ages or milestones.
              </p>
              <button className="text-accent-teal font-medium flex items-center gap-1 hover:gap-2 transition-all">
                View Example
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Founder Vesting */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-card-hover p-8 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent-amber/20 flex items-center justify-center mb-6 group-hover:bg-accent-amber/30 transition-colors glow-amber">
                <Zap className="w-8 h-8 text-accent-amber" />
              </div>
              <h3 className="text-h3 font-display font-semibold mb-3">Founder Vesting</h3>
              <p className="text-text-secondary mb-4 leading-relaxed">
                Time-locked token distribution for team members, advisors, and early contributors.
              </p>
              <button className="text-accent-amber font-medium flex items-center gap-1 hover:gap-2 transition-all">
                View Example
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Recurring Payments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="glass-card-hover p-8 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent-purple/20 flex items-center justify-center mb-6 group-hover:bg-accent-purple/30 transition-colors glow-purple">
                <Clock className="w-8 h-8 text-accent-purple" />
              </div>
              <h3 className="text-h3 font-display font-semibold mb-3">Recurring Payments</h3>
              <p className="text-text-secondary mb-4 leading-relaxed">
                Automated periodic distributions for allowances, grants, or scheduled transfers.
              </p>
              <button className="text-accent-purple font-medium flex items-center gap-1 hover:gap-2 transition-all">
                View Example
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Save Bitcoin */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="glass-card-hover p-8 group cursor-pointer"
              onClick={() => navigate('/save')}
            >
              <div className="w-16 h-16 rounded-2xl bg-accent-teal/20 flex items-center justify-center mb-6 group-hover:bg-accent-teal/30 transition-colors glow-teal">
                <Wallet className="w-8 h-8 text-accent-teal" />
              </div>
              <h3 className="text-h3 font-display font-semibold mb-3">Save Bitcoin</h3>
              <p className="text-text-secondary mb-4 leading-relaxed">
                Secure your BTC savings with optional time-locks. Build your Bitcoin stack safely and earn future yield.
              </p>
              <button className="text-accent-teal font-medium flex items-center gap-1 hover:gap-2 transition-all">
                Start Saving
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-h1 font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-text-secondary">
              Four simple steps to programmable Bitcoin distribution
            </p>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                number: '01',
                title: 'Lock Bitcoin',
                description: 'Deposit BTC into a programmable vault secured by Charms Protocol smart contracts.',
                icon: Lock,
                color: 'teal',
              },
              {
                number: '02',
                title: 'Set Time Conditions',
                description: 'Define unlock schedules with specific dates, block heights, or recurring intervals.',
                icon: Clock,
                color: 'amber',
              },
              {
                number: '03',
                title: 'Define Beneficiaries',
                description: 'Specify recipients and their allocation percentages with cryptographic precision.',
                icon: Users,
                color: 'purple',
              },
              {
                number: '04',
                title: 'Automatic Distribution',
                description: 'Bitcoin distributes automatically when conditions are met. Trustless. Permissionless.',
                icon: Zap,
                color: 'teal',
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card p-8 flex flex-col md:flex-row items-start gap-6"
              >
                <div className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-accent-${step.color}/20 flex items-center justify-center glow-${step.color}`}>
                  <step.icon className={`w-8 h-8 text-accent-${step.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-4xl font-display font-bold text-text-muted/30">
                      {step.number}
                    </span>
                    <h3 className="text-h3 font-display font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-text-secondary text-lg leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why CharmVault */}
      <section className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-h1 font-display font-bold mb-4">
              Why CharmVault
            </h2>
            <p className="text-xl text-text-secondary">
              Bitcoin infrastructure built on trust-minimized principles
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Lock,
                title: 'Non-Custodial',
                description: 'Your keys, your Bitcoin. We never hold custody.',
              },
              {
                icon: Shield,
                title: 'Bitcoin-Native',
                description: 'Built directly on Bitcoin. No bridges or wrapped tokens.',
              },
              {
                icon: Code,
                title: 'Zero-Knowledge Proofs',
                description: 'Privacy-preserving cryptographic verification.',
              },
              {
                icon: CheckCircle,
                title: 'Permissionless',
                description: 'Anyone can trigger distribution when conditions are met.',
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card p-6 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-teal/20 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-accent-teal" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Credibility */}
      <section className="py-24 px-4 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card p-12 text-center"
          >
            <h3 className="text-h2 font-display font-bold mb-6">
              Powered by Charms Protocol
            </h3>
            <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed">
              CharmVault leverages Charms Protocol's client-side validation and programmable Bitcoin primitives
              to enable trustless, verifiable vault operations.
            </p>

            {/* Simple Flow Diagram */}
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="glass-card px-6 py-3 rounded-full">
                <span className="text-text-secondary">UTXO Lock</span>
              </div>
              <ArrowRight className="w-5 h-5 text-accent-teal" />
              <div className="glass-card px-6 py-3 rounded-full">
                <span className="text-text-secondary">Programmable Logic</span>
              </div>
              <ArrowRight className="w-5 h-5 text-accent-teal" />
              <div className="glass-card px-6 py-3 rounded-full">
                <span className="text-text-secondary">Distributed</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-teal/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-display font-display font-bold mb-6">
              Start Building with
              <span className="block gradient-text">Programmable Vaults</span>
            </h2>
            <p className="text-xl text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed">
              Join the future of Bitcoin infrastructure. Create trustless vaults with time-locked distribution
              enforced by Bitcoin itself.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!walletState ? (
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="group px-10 py-5 bg-accent-teal rounded-xl font-bold text-xl text-white shadow-glow-teal hover:shadow-xl transition-all duration-300 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting Wallet...' : 'Connect Wallet to Start'}
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="group px-10 py-5 bg-accent-teal rounded-xl font-bold text-xl text-white shadow-glow-teal hover:shadow-xl transition-all duration-300 flex items-center gap-3"
                >
                  Create Your First Vault
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            <p className="mt-8 text-sm text-text-muted">
              CharmVault is non-custodial and irreversible by design.
              <span className="block mt-1">This will work in 10 years. No one can interfere.</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-text-muted text-sm">
            © 2025 CharmVault. Built on Charms Protocol.
          </div>
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <a href="#" className="hover:text-accent-teal transition-colors">Documentation</a>
            <a href="#" className="hover:text-accent-teal transition-colors">GitHub</a>
            <a href="#" className="hover:text-accent-teal transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
