import { useState } from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import HubTabs, { type HubTab } from '../components/dashboard/HubTabs'
import RiskAssessmentPage from './RiskAssessmentPage'
import ReadmissionRiskPage from './ReadmissionRiskPage'

const TABS: HubTab[] = [
  { key: 'risk',        label: 'Risk Assessment', icon: TrendingUp, color: '#EF4444' },
  { key: 'readmission', label: 'Readmission',     icon: RefreshCw,  color: '#14B8A6' },
]

export default function RiskReadmissionHubPage() {
  const [tab, setTab] = useState('risk')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'risk' ? <RiskAssessmentPage /> : <ReadmissionRiskPage />}
      </div>
    </div>
  )
}
