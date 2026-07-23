import { useEffect, useRef, useState } from 'react'
import { BACKEND_URL } from '../lib/backend'

/** Generalized from ScribePage.tsx's MediaRecorder pattern — records, then POSTs straight to
 * the STT-only /assistant/transcribe endpoint and hands the transcript back for the caller to
 * drop into an input box (not auto-sent, so the user can review/edit first). */
export function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => () => {
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
  }, [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('file', blob, 'recording.webm')
          const res = await fetch(`${BACKEND_URL}/api/v1/assistant/transcribe`, {
            method: 'POST', body: form, signal: AbortSignal.timeout(30000),
          })
          if (!res.ok) {
            const detail = await res.json().catch(() => null)
            throw new Error(detail?.detail || `Transcription failed (${res.status})`)
          }
          const data = await res.json()
          onTranscript(data.transcript || '')
        } catch (exc) {
          setError(exc instanceof Error ? exc.message : 'Transcription failed')
        }
        setTranscribing(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Microphone access denied or unavailable')
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return { recording, transcribing, error, start, stop }
}
