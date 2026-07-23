import { useState } from 'react'
import { Brain, FileText, ClipboardList, LogOut, History } from 'lucide-react'
import { getOrCreateDeviceId } from '../context/AssistantContext'
import type { ClinicalRunMode, ClinicalRunRecord } from '../types/clinical'
import AnalyzeNoteTab from '../components/clinical-nlp-text/AnalyzeNoteTab'
import NoteSummaryTab from '../components/clinical-nlp-text/NoteSummaryTab'
import ReportSummaryTab from '../components/clinical-nlp-text/ReportSummaryTab'
import DischargeLetterTab from '../components/clinical-nlp-text/DischargeLetterTab'
import HistoryPanel from '../components/clinical-nlp-text/HistoryPanel'
import StatsPanel from '../components/clinical-nlp-text/StatsPanel'
import { CARD_BG, BORDER, TEXT_SUB } from '../components/clinical-nlp-text/shared'

const COLOR = '#F59E0B'

type Tab = ClinicalRunMode | 'history'

const TAB_META: Record<Tab, { label: string; icon: typeof Brain; color: string }> = {
  nlp_analyze: { label: 'Analyze Note', icon: Brain, color: '#F59E0B' },
  note_summary: { label: 'Note Summary', icon: FileText, color: '#EC4899' },
  report_summary: { label: 'Report Summary', icon: ClipboardList, color: '#14B8A6' },
  discharge_letter: { label: 'Discharge Letter', icon: LogOut, color: '#F59E0B' },
  history: { label: 'History', icon: History, color: '#0EA5E9' },
}

export default function ClinicalNLPTextPage() {
  const [deviceId] = useState(getOrCreateDeviceId)
  const [tab, setTab] = useState<Tab>('nlp_analyze')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editSeed, setEditSeed] = useState<ClinicalRunRecord | null>(null)

  function bumpRefresh() {
    setRefreshKey(k => k + 1)
  }

  function handleEditRecord(record: ClinicalRunRecord) {
    setEditSeed(record)
    setTab(record.mode)
  }

  function consumeEditSeed() {
    setEditSeed(null)
  }

  const meta = TAB_META[tab]

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <meta.icon size={20} color={meta.color} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Clinical NLP &amp; Text Generation</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Entity extraction · Note &amp; report summarisation · Discharge letters</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
          <div style={{ display: 'flex', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '3px', flexWrap: 'wrap' }}>
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

      {tab === 'nlp_analyze' && <AnalyzeNoteTab editSeed={editSeed} onConsumeEditSeed={consumeEditSeed} onRunComplete={bumpRefresh} />}
      {tab === 'note_summary' && <NoteSummaryTab editSeed={editSeed} onConsumeEditSeed={consumeEditSeed} onRunComplete={bumpRefresh} />}
      {tab === 'report_summary' && <ReportSummaryTab editSeed={editSeed} onConsumeEditSeed={consumeEditSeed} onRunComplete={bumpRefresh} />}
      {tab === 'discharge_letter' && <DischargeLetterTab editSeed={editSeed} onConsumeEditSeed={consumeEditSeed} onRunComplete={bumpRefresh} />}
      {tab === 'history' && <HistoryPanel deviceId={deviceId} refreshKey={refreshKey} onBumpRefresh={bumpRefresh} onEditRecord={handleEditRecord} />}

    </div>
  )
}
