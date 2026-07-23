import { useState } from 'react'
import { Mic, MessageSquare } from 'lucide-react'
import HubTabs, { type HubTab } from '../components/dashboard/HubTabs'
import ScribePage from './ScribePage'
import ChatAssistantPage from './ChatAssistantPage'

const TABS: HubTab[] = [
  { key: 'scribe', label: 'Ambient Scribe', icon: Mic,           color: '#EC4899' },
  { key: 'chat',   label: 'Chat Assistant', icon: MessageSquare, color: '#0EA5E9' },
]

export default function AIClinicalAssistantHubPage() {
  const [tab, setTab] = useState('scribe')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'scribe' ? <ScribePage /> : <ChatAssistantPage />}
      </div>
    </div>
  )
}
