import { apiGet, apiPost, apiPatch, apiDelete, BACKEND_URL } from '../lib/backend'
import { usePolledResource } from './usePolling'
import type { DecisionSupportMode, DecisionSupportRunSummary, DecisionSupportRunRecord, DecisionSupportStats, DrugInteraction, InteractionSource } from '../types/clinical'

// ─── Decision Support: drug-interaction history & stats (device-scoped, no login) ───

export interface InteractionCheckResult {
  interacts: boolean
  severity: 'critical' | 'high' | 'medium' | null
  effect: string | null
  mechanism: string | null
  source?: InteractionSource
}

/** Stateless pairwise lookup — no history row is written. */
export async function checkInteraction(drugA: string, drugB: string): Promise<InteractionCheckResult | null> {
  try {
    return await apiPost<InteractionCheckResult>('/api/v1/decision-support/check', { drug_a: drugA, drug_b: drugB })
  } catch {
    return null
  }
}

/** Stateless regimen (multi-drug) lookup — no history row is written. */
export async function checkRegimen(drugs: string[]): Promise<DrugInteraction[] | null> {
  try {
    const res = await apiPost<{ interactions: DrugInteraction[] }>('/api/v1/decision-support/check-regimen', { drugs })
    return res.interactions
  } catch {
    return null
  }
}

export interface DecisionRunRequest {
  device_id: string
  mode: DecisionSupportMode
  drug_a?: string
  drug_b?: string
  drugs?: string[]
  patient_id?: string | null
  patient_name?: string | null
}

/** Runs a check AND persists it to history in one call — used by the Checker tabs so every
 * check a user performs shows up in History. */
export async function runDecisionSupportCheck(req: DecisionRunRequest): Promise<DecisionSupportRunRecord> {
  return apiPost('/api/v1/decision-support/run', req)
}

/** `refreshKey` lets callers force an immediate re-fetch (e.g. right after a run/delete)
 * instead of waiting for the next poll tick. */
export function useDecisionSupportHistory(deviceId: string, filters: { mode?: string; patient_id?: string }, refreshKey: number): DecisionSupportRunSummary[] {
  const params = new URLSearchParams({ device_id: deviceId })
  if (filters.mode) params.set('mode', filters.mode)
  if (filters.patient_id) params.set('patient_id', filters.patient_id)

  const [data] = usePolledResource<{ history: DecisionSupportRunSummary[] }>(
    () => apiGet(`/api/v1/decision-support/history?${params.toString()}`),
    15000, [deviceId, filters.mode, filters.patient_id, refreshKey], { history: [] },
  )
  return data.history
}

export function useDecisionSupportStats(deviceId: string, refreshKey: number): DecisionSupportStats {
  const [data] = usePolledResource<DecisionSupportStats>(
    () => apiGet(`/api/v1/decision-support/stats?device_id=${encodeURIComponent(deviceId)}`),
    15000, [deviceId, refreshKey], { by_mode: [], by_day: [], severity_freq: [], top_drugs: [], success_count: 0, error_count: 0 },
  )
  return data
}

export async function fetchDecisionSupportRecord(id: number, deviceId: string): Promise<DecisionSupportRunRecord> {
  return apiGet(`/api/v1/decision-support/history/${id}?device_id=${encodeURIComponent(deviceId)}`)
}

export async function deleteDecisionSupportRecord(id: number, deviceId: string): Promise<void> {
  await apiDelete(`/api/v1/decision-support/history/${id}?device_id=${encodeURIComponent(deviceId)}`)
}

/** Relabels a saved run's patient linkage — the computed drugs/interactions/severity are
 * immutable results of the check itself, so only patient_id/patient_name are editable. */
export async function updateDecisionSupportRecord(id: number, deviceId: string, updates: { patient_id?: string | null; patient_name?: string | null }): Promise<DecisionSupportRunRecord> {
  return apiPatch(`/api/v1/decision-support/history/${id}`, { device_id: deviceId, ...updates })
}

async function downloadBlob(res: Response, filename: string) {
  if (!res.ok) throw new Error('PDF generation failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadDecisionSupportRecordPdf(id: number, deviceId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/decision-support/history/${id}/pdf?device_id=${encodeURIComponent(deviceId)}`)
  await downloadBlob(res, `decision-support-run-${id}.pdf`)
}

export async function downloadDecisionSupportHistoryPdf(deviceId: string, ids: number[]): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/decision-support/history/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, ids }),
  })
  await downloadBlob(res, 'decision-support-history-export.pdf')
}
