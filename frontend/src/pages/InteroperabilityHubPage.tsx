import { useState } from 'react'
import { ArrowLeftRight, LayoutDashboard } from 'lucide-react'
import HubTabs, { type HubTab } from '../components/dashboard/HubTabs'
import HL7FHIRPage from './HL7FHIRPage'
import FHIRExplorerPage from './FHIRExplorerPage'

const TABS: HubTab[] = [
  { key: 'converter', label: 'HL7 → FHIR Converter', icon: ArrowLeftRight,  color: '#0EA5E9' },
  { key: 'explorer',  label: 'FHIR Data Explorer',    icon: LayoutDashboard, color: '#14B8A6' },
]

export default function InteroperabilityHubPage() {
  const [tab, setTab] = useState('converter')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'converter' ? <HL7FHIRPage /> : <FHIRExplorerPage />}
      </div>
    </div>
  )
}
