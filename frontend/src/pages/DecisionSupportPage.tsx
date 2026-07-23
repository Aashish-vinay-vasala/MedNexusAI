import { useState } from 'react'
import { Brain, ClipboardCheck, History } from 'lucide-react'
import { getOrCreateDeviceId } from '../context/AssistantContext'
import CheckerTab from '../components/decision-support/CheckerTab'
import HistoryPanel from '../components/decision-support/HistoryPanel'
import StatsPanel from '../components/decision-support/StatsPanel'
import { TEXT_SUB } from '../components/decision-support/shared'

const COLOR = '#F59E0B'

type Tab = 'checker' | 'history'

const TAB_META: Record<Tab, { label: string; icon: typeof Brain; color: string }> = {
  checker: { label: 'Checker', icon: ClipboardCheck, color: '#F59E0B' },
  history: { label: 'History', icon: History, color: '#0EA5E9' },
}

export default function DecisionSupportPage() {
  const [deviceId] = useState(getOrCreateDeviceId)
  const [tab, setTab] = useState<Tab>('checker')
  const [refreshKey, setRefreshKey] = useState(0)

  function bumpRefresh() {
    setRefreshKey(k => k + 1)
  }

  const meta = TAB_META[tab]

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${COLOR}18`, border: `1px solid ${COLOR}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <meta.icon size={20} color={meta.color} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Decision Support</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Drug interaction checker · Clinical rules engine</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
          <div style={{ display: 'flex', background: '#111827', border: '1px solid #1F2937', borderRadius: '8px', padding: '3px', flexWrap: 'wrap' }}>
            {(Object.keys(TAB_META) as Tab[]).map(t => {
              const TabIcon = TAB_META[t].icon
              return (
                <button key={t} onClick={() => setTab(t)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: 'none', background: tab === t ? `${TAB_META[t].color}20` : 'transparent', color: tab === t ? TAB_META[t].color : TEXT_SUB, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <TabIcon size={12} /> {TAB_META[t].label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <StatsPanel deviceId={deviceId} refreshKey={refreshKey} />
      </div>

      {tab === 'checker' && <CheckerTab deviceId={deviceId} onRunComplete={bumpRefresh} />}
      {tab === 'history' && <HistoryPanel deviceId={deviceId} refreshKey={refreshKey} onBumpRefresh={bumpRefresh} />}

    </div>
  )
}
