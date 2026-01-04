import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import CreateVault from './pages/CreateVault'
import SaveBitcoin from './pages/SaveBitcoin'
import VaultDetails from './pages/VaultDetails'
import ManageBeneficiaries from './pages/ManageBeneficiaries'
import DistributeVault from './pages/DistributeVault'
import BeneficiaryView from './pages/BeneficiaryView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreateVault />} />
        <Route path="/save" element={<SaveBitcoin />} />
        <Route path="/vault/:id" element={<VaultDetails />} />
        <Route path="/vault/:id/beneficiaries" element={<ManageBeneficiaries />} />
        <Route path="/vault/:id/distribute" element={<DistributeVault />} />
        <Route path="/beneficiary" element={<BeneficiaryView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
