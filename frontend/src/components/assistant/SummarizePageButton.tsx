import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { apiGet } from '../../lib/backend'
import { BACKEND_URL } from '../../lib/backend'
import type { AssistantMessage } from '../../context/AssistantContext'

type Props = {
  pageName: string
  color: string
  disabled?: boolean
  onStart: () => void
  onResult: (message: AssistantMessage) => void
}

/** Gathers whatever data is already cheap to fetch for the current page (one-shot GETs, not
 * the app's polling hooks, so this doesn't add background load on every page). Modules without
 * data wired here still work — the backend prompt just falls back to a page-name-only summary. */
async function gatherPageData(pageName: string): Promise<Record<string, unknown>> {
  try {
    if (pageName === 'Overview') {
      const [kpi, alerts, admissions, forecast] = await Promise.all([
        apiGet('/api/v1/kpi'), apiGet('/api/v1/alerts'), apiGet('/api/v1/admissions'), apiGet('/api/v1/forecast'),
      ])
      return { kpi, alerts, admissions, forecast }
    }
    if (pageName === 'Patient Management') {
      return { patients: await apiGet('/api/v1/patients') }
    }
    if (pageName === 'Risk & Readmission' || pageName === 'Patient Monitoring') {
      const [patients, alerts] = await Promise.all([apiGet('/api/v1/patients'), apiGet('/api/v1/alerts')])
      return { patients, alerts }
    }
  } catch { /* fall through to the minimal payload below */ }
  return { note: 'No page-specific data wired for this module yet — give a general orientation instead.' }
}

export default function SummarizePageButton({ pageName, color, disabled, onStart, onResult }: Props) {
  const [loading, setLoading] = useState(false)

  async function summarize() {
    if (loading || disabled) return
    setLoading(true)
    onStart()
    try {
      const data = await gatherPageData(pageName)
      const res = await fetch(`${BACKEND_URL}/api/v1/assistant/summarize-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pageName, data }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Backend error ${res.status}`)
      }
      const result = await res.json()
      onResult({ role: 'assistant', text: result.summary })
    } catch (exc) {
      onResult({ role: 'error', text: exc instanceof Error ? exc.message : 'Failed to summarize this page' })
    }
    setLoading(false)
  }

  return (
    <button onClick={summarize} disabled={loading || disabled} className="mnx-btn mnx-btn-accent" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '0 16px',
      padding: '7px', borderRadius: '8px', border: `1px solid ${color}30`, background: `${color}10`,
      color, fontSize: '11px', fontWeight: 600, cursor: loading || disabled ? 'not-allowed' : 'pointer',
      opacity: loading || disabled ? 0.6 : 1, flexShrink: 0,
      ['--mnx-accent' as string]: color,
    } as React.CSSProperties}>
      <Sparkles size={12} />
      {loading ? 'Summarizing…' : 'Summarize This Page'}
    </button>
  )
}
