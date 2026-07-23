import { useCallback } from 'react'
import { BACKEND_URL } from '../lib/backend'
import type { AssistantMessage } from '../context/AssistantContext'

export type ChatAttachment = { kind: 'image' | 'audio' | 'document'; label: string; extracted_text: string }

type AskOptions = {
  deviceId: string
  sessionId: number | null
  patientId?: string | null
  patientName?: string | null
  context?: Record<string, unknown>
  webSearch?: boolean
  attachments?: ChatAttachment[]
}

type ChatResponse = { answer: string; session_id: number; sources: AssistantMessage['sources'] }

/** Single place that calls POST /api/v1/assistant/chat — shared by the global floating widget
 * and the patient-scoped ChatAssistantPage so prompt/response handling never drifts. */
export function useAssistantChat(
  setMessages: React.Dispatch<React.SetStateAction<AssistantMessage[]>>,
  setAsking: (v: boolean) => void,
  onSessionId?: (id: number) => void,
) {
  const ask = useCallback(async (question: string, opts: AskOptions): Promise<ChatResponse | null> => {
    const trimmed = question.trim()
    if (!trimmed) return null
    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    setAsking(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          device_id: opts.deviceId,
          session_id: opts.sessionId,
          patient_id: opts.patientId ?? null,
          patient_name: opts.patientName ?? null,
          context: opts.context ?? {},
          web_search: opts.webSearch ?? false,
          attachments: opts.attachments ?? [],
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Backend error ${res.status}`)
      }
      const data = await res.json() as ChatResponse
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer, sources: data.sources }])
      if (onSessionId && data.session_id) onSessionId(data.session_id)
      setAsking(false)
      return data
    } catch (exc) {
      setMessages(prev => [...prev, { role: 'error', text: exc instanceof Error ? exc.message : 'Failed to get an answer' }])
      setAsking(false)
      return null
    }
  }, [setMessages, setAsking, onSessionId])

  return { ask }
}
