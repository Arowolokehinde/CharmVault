# CharmVault

> **An all-in-one Bitcoin platform that lets users automate payments, save BTC, and earn yield—without leaving the Bitcoin ecosystem**

CharmVault leverages the [Charms Protocol v8](https://docs.charms.dev) to enable programmable Bitcoin vaults with time-locked releases, automated distributions, and trustless beneficiary management—all secured by Bitcoin's native layer.

![CharmVault Banner](https://img.shields.io/badge/Bitcoin-Protocol-orange?style=for-the-badge&logo=bitcoin)
![Testnet4](https://img.shields.io/badge/Network-Testnet4-blue?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)

---

## 🎯 Features

### 🔒 **Programmable Vaults**
- **Time-locked Bitcoin storage** with customizable unlock conditions
- **Multi-beneficiary support** with percentage-based allocations
- **Automated distribution** when unlock conditions are met
- **Non-custodial** - you control your Bitcoin at all times

### 💰 **Bitcoin Savings**
- **Flexible time-locks** (30 days, 90 days, 1 year, or custom)
- **Self-custody** - you are the sole beneficiary
- **Yield integration** (coming soon)
- **Visual progress tracking** with block-based countdowns

### ⚡ **Automated Payments**
- **Vesting schedules** for recurring distributions
- **Trust fund management** with time-delayed releases
- **Recurring payments** for allowances, grants, or subscriptions
- **Beneficiary management** with update capabilities

### 🛡️ **Security & Trust**
- **Zero-knowledge proofs** via Charms Protocol v8
- **Bitcoin-native** - no wrapped tokens or bridges
- **Trustless execution** - enforced by Bitcoin consensus
- **Permissionless** - no intermediaries or gatekeepers

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Unisat    │  │   Leather    │  │   Wallet     │       │
│  │   Wallet    │  │   Wallet     │  │   State      │       │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                │                  │               │
│         └────────────────┴──────────────────┘               │
│                          │                                  │
│              ┌───────────▼───────────┐                      │
│              │   Vault Service       │                      │
│              │  - Create Vault       │                      │
│              │  - Build Spell        │                      │
│              │  - Sign TX            │                      │
│              └───────────┬───────────┘                      │
└──────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────▼─────────────┐
              │   Charms Prover API      │
              │   (v8.charms.dev)        │
              │  - Generate ZK Proofs    │
              │  - Return Commit + Spell │
              └────────────┬─────────────┘
                           │
              ┌────────────▼─────────────┐
              │   Backend Proxy          │
              │   (Express.js)           │
              │  - CORS handling         │
              │  - Package relay         │
              └────────────┬─────────────┘
                           │
              ┌────────────▼─────────────┐
              │   Bitcoin Core RPC       │
              │   (Testnet4)             │
              │  - submitpackage         │
              │  - Atomic broadcast      │
              └──────────────────────────┘
                           │
              ┌────────────▼─────────────┐
              │   Bitcoin Network        │
              │   (Testnet4)             │
              └──────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ and npm
- **Bitcoin Core** v24.0+ (for broadcasting transactions)
- **Browser wallet**: [Unisat](https://unisat.io) or [Leather](https://leather.io)
- **Testnet4 BTC** (get from [faucet](https://testnet4.anyone.eu.org/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/CharmVault.git
   cd CharmVault
   ```

2. **Install frontend dependencies**
   ```bash
   cd CharmVault-Frontend
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../CharmVaultBackend
   npm install
   ```

4. **Set up Bitcoin Core** (see [Bitcoin Core Setup](#bitcoin-core-setup))

---

## ⚙️ Configuration

### Frontend Setup

Create `.env` file in `CharmVault-Frontend/`:

```bash
# Bitcoin Network
VITE_BITCOIN_NETWORK=testnet4

# Charms Prover API
VITE_PROVER_API_URL=https://v8.charms.dev/prove

# Backend Proxy
VITE_BACKEND_URL=http://localhost:3001
```

### Backend Setup

Create `.env` file in `CharmVaultBackend/`:

```bash
# Server Configuration
PORT=3001

# Bitcoin Core RPC
BITCOIN_RPC_HOST=localhost
BITCOIN_RPC_PORT=18332
BITCOIN_RPC_USER=charmvault
BITCOIN_RPC_PASSWORD=your_secure_password_here

# Network
BITCOIN_NETWORK=testnet4
```

---

## 🔧 Bitcoin Core Setup

### macOS

1. **Install Bitcoin Core**
   ```bash
   brew install bitcoin
   ```

2. **Create configuration file**
   ```bash
   mkdir -p ~/Library/Application\ Support/Bitcoin
   cat > ~/Library/Application\ Support/Bitcoin/bitcoin.conf <<EOF
   # Testnet4 configuration
   chain=testnet4
   testnet4=1

   # RPC server
   server=1
   rpcuser=charmvault
   rpcpassword=your_secure_password_here
   rpcport=18332
   rpcallowip=127.0.0.1

   # Package relay support (required for Charms)
   # Bitcoin Core 24.0+ supports this by default

   # Optional: Prune to save disk space
   prune=10000
   EOF
   ```

3. **Start Bitcoin Core**
   ```bash
   bitcoind -daemon
   ```

4. **Verify sync status**
   ```bash
   bitcoin-cli -testnet4 getblockchaininfo
   ```

### Linux

1. **Download Bitcoin Core**
   ```bash
   wget https://bitcoincore.org/bin/bitcoin-core-28.0/bitcoin-28.0-x86_64-linux-gnu.tar.gz
   tar xzf bitcoin-28.0-x86_64-linux-gnu.tar.gz
   sudo install -m 0755 -o root -g root -t /usr/local/bin bitcoin-28.0/bin/*
   ```

2. **Create configuration** (same as macOS, but path is `~/.bitcoin/bitcoin.conf`)

3. **Start Bitcoin Core**
   ```bash
   bitcoind -daemon
   ```

---

## 🎮 Running the Application

### Development Mode

1. **Start Bitcoin Core** (if not already running)
   ```bash
   bitcoind -daemon
   ```

2. **Start backend proxy**
   ```bash
   cd CharmVaultBackend
   npm start
   ```

3. **Start frontend** (in a new terminal)
   ```bash
   cd CharmVault-Frontend
   npm run dev
   ```

4. **Open browser**
   ```
   http://localhost:5173
   ```

5. **Connect wallet**
   - Install [Unisat](https://unisat.io) or [Leather](https://leather.io)
   - Switch to **Testnet4**
   - Get testnet BTC from [faucet](https://testnet4.anyone.eu.org/)
   - Connect via CharmVault UI

---

## 📖 Usage Guide

### Creating a Vault

1. **Navigate to Dashboard** → Click "Create Automation"
2. **Configure vault**:
   - Enter vault name
   - Set BTC amount to lock
   - Add beneficiaries with allocation percentages (must total 100%)
   - Set unlock date or vesting schedule
3. **Review & Confirm** → Sign with wallet
4. **Wait for ZK proof** (~5 minutes) → Broadcast transactions

### Creating Savings

1. **Navigate to Dashboard** → Click "Savings"
2. **Configure savings**:
   - Enter savings name (optional)
   - Set BTC amount
   - Choose time-lock period (or none for instant withdrawal)
3. **Confirm** → Sign with wallet → Wait for proof → Broadcast

### Managing Beneficiaries

1. **Go to Vault Details** → Click "Edit" (only before unlock)
2. **Update beneficiary addresses** (percentages are fixed after creation)
3. **Sign transaction** → Broadcast update

### Triggering Distribution

1. **Wait for unlock date** → Vault status changes to "Unlocked"
2. **Any beneficiary** can trigger distribution
3. **Click "Trigger Distribution"** → Sign → Broadcast
4. **Bitcoin automatically distributed** according to allocations

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Router** - Navigation
- **Bitcoinjs-lib** - Bitcoin transaction handling
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **Axios** - HTTP client for Bitcoin Core RPC
- **CORS** - Cross-origin resource sharing

### Bitcoin & Protocol
- **Bitcoin Core** - Full node & transaction relay
- **Charms Protocol v8** - Zero-knowledge smart contracts
- **Testnet4** - Bitcoin test network

---

## 📁 Project Structure

```
CharmVault/
├── CharmVault-Frontend/          # React frontend
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Route pages
│   │   │   ├── LandingPage.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── CreateVault.tsx
│   │   │   ├── SaveBitcoin.tsx
│   │   │   ├── VaultDetails.tsx
│   │   │   └── ...
│   │   ├── services/             # Business logic
│   │   │   ├── bitcoin/          # Bitcoin client
│   │   │   ├── charms/           # Charms protocol integration
│   │   │   │   ├── vaultService.ts
│   │   │   │   ├── spellBuilder.ts
│   │   │   │   └── proverClient.ts
│   │   │   ├── wallets/          # Wallet integrations
│   │   │   └── vaultParams.ts    # Local storage
│   │   ├── types/                # TypeScript types
│   │   └── App.tsx               # Main app component
│   ├── package.json
│   └── vite.config.ts
│
├── CharmVaultBackend/            # Express backend proxy
│   ├── server.js                 # Main server file
│   ├── package.json
│   └── README.md
│
├── CharmContract/                # Smart contract (if applicable)
│
└── README.md                     # This file
```

---

## 🔍 How It Works

### 1. Vault Creation Flow

```
User Input → Build Spell → Request ZK Proof → Sign Transactions → Broadcast Package
```

1. **User configures vault** (amount, beneficiaries, unlock conditions)
2. **Frontend builds Charms spell** (YAML-like smart contract)
3. **Prover API generates ZK proof** (~5 minutes)
4. **Returns commit TX + spell TX** (pre-signed with proof)
5. **User signs commit TX** with wallet
6. **Backend broadcasts both TXs atomically** via `submitpackage`
7. **Bitcoin network confirms** → Vault is live!

### 2. Why Package Relay?

Charms transactions require **atomic broadcast** of two dependent transactions:
- **Commit TX**: Locks the funding UTXO
- **Spell TX**: Creates the programmable vault UTXO

**Problem**: Sequential broadcast fails because:
- Commit TX marks funding UTXO as "spent"
- Spell TX tries to spend the same UTXO → rejected as double-spend
- ZK proof signature becomes invalid if TX structure changes

**Solution**: Bitcoin Core's `submitpackage` RPC:
- Broadcasts both TXs together in one atomic operation
- Mempool validates them as a package
- No double-spend conflict, ZK proof remains valid ✅

### 3. Security Model

- **Non-custodial**: Users control private keys via browser wallets
- **Trustless**: Smart contract logic enforced by Bitcoin consensus
- **Zero-knowledge**: Charms proofs verify correctness without revealing contract logic
- **Permissionless**: No central authority can freeze or seize funds

---

## 🧪 Testing

### Unit Tests
```bash
cd CharmVault-Frontend
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing Checklist

- [ ] Connect Unisat wallet
- [ ] Connect Leather wallet
- [ ] Create vault with 2+ beneficiaries
- [ ] Create savings with time-lock
- [ ] View vault details
- [ ] Update beneficiaries (before unlock)
- [ ] Trigger distribution (after unlock)
- [ ] Check transaction on [mempool.space](https://mempool.space/testnet4)

---

## 🚢 Deployment

### Frontend (Vercel/Netlify)

1. **Build production bundle**
   ```bash
   cd CharmVault-Frontend
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Set environment variables** in Vercel dashboard

### Backend (DigitalOcean/AWS)

1. **Set up VPS** with Bitcoin Core
2. **Install Node.js** and dependencies
3. **Configure firewall** (allow only frontend origin)
4. **Use PM2** for process management
   ```bash
   npm install -g pm2
   pm2 start server.js --name charmvault-backend
   pm2 save
   pm2 startup
   ```

### Mainnet Checklist

- [ ] Update `.env` to `VITE_BITCOIN_NETWORK=mainnet`
- [ ] Configure Bitcoin Core for mainnet
- [ ] Update RPC port to `8332`
- [ ] Test with small amounts first
- [ ] Verify all transactions on mainnet explorer
- [ ] Enable monitoring and alerts

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Follow existing config
- **Prettier**: Auto-format on save
- **Commits**: Use conventional commit format

---

## 🐛 Troubleshooting

### Common Issues

**"Failed to connect wallet"**
- Ensure wallet extension is installed
- Switch wallet to Testnet4
- Refresh page and try again

**"CORS error when broadcasting"**
- Check backend proxy is running (`http://localhost:3001`)
- Verify `.env` has correct `VITE_BACKEND_URL`
- Check browser console for detailed error

**"Package broadcast failed"**
- Ensure Bitcoin Core is synced (`bitcoin-cli -testnet4 getblockchaininfo`)
- Check RPC credentials match between `bitcoin.conf` and backend `.env`
- Verify Bitcoin Core version is 24.0+ (supports `submitpackage`)

**"Invalid Schnorr signature"**
- This means transaction was modified after proof generation
- Don't modify spell TX structure
- Use transactions exactly as Prover API returns them

**"Duplicate funding UTXO spend"**
- Prover API already processed this UTXO with different parameters
- Use a different UTXO (get fresh testnet BTC)
- Wait 5 minutes for UTXO cooldown to expire

---

## 📚 Resources

- **Charms Protocol Docs**: https://docs.charms.dev
- **Bitcoin Core RPC**: https://bitcoincore.org/en/doc/
- **Testnet4 Faucet**: https://testnet4.anyone.eu.org/
- **Mempool Explorer**: https://mempool.space/testnet4
- **Unisat Wallet**: https://unisat.io
- **Leather Wallet**: https://leather.io

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Charms Protocol Team** - For building programmable Bitcoin primitives
- **Bitcoin Core Contributors** - For maintaining Bitcoin infrastructure
- **Unisat & Leather Teams** - For excellent wallet UX

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/CharmVault/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/CharmVault/discussions)
- **Twitter**: [@CharmVault](https://twitter.com/charmvault) (if applicable)

---

<div align="center">
  <strong>Built with 🧡 for Bitcoin</strong>
  <br/>
  <sub>CharmVault - Programmable Bitcoin Vaults</sub>
</div>
