import { useState } from 'react'
import { Activity, HeartPulse, AlertTriangle, FlaskConical } from 'lucide-react'
import HubTabs, { type HubTab } from '../components/dashboard/HubTabs'
import ICUMonitoringPage from './ICUMonitoringPage'
import VitalSignsPage from './VitalSignsPage'
import SepsisWarningPage from './SepsisWarningPage'
import LabResultsPage from './LabResultsPage'

const TABS: HubTab[] = [
  { key: 'icu',    label: 'ICU Monitoring',      icon: Activity,      color: '#EF4444' },
  { key: 'vitals', label: 'Vital Signs Monitor', icon: HeartPulse,    color: '#0EA5E9' },
  { key: 'sepsis', label: 'Sepsis Warning',      icon: AlertTriangle, color: '#F59E0B' },
  { key: 'labs',   label: 'Lab Results',         icon: FlaskConical,  color: '#14B8A6' },
]

export default function PatientMonitoringHubPage() {
  const [tab, setTab] = useState('icu')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'icu' ? <ICUMonitoringPage /> : tab === 'vitals' ? <VitalSignsPage /> : tab === 'sepsis' ? <SepsisWarningPage /> : <LabResultsPage />}
      </div>
    </div>
  )
}
