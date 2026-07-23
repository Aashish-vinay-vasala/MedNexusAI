import { useEffect, useState } from 'react'

const VOICE_KEY = 'mednexus.assistant.voice_uri'
const RATE_KEY = 'mednexus.assistant.rate'
const AUTOSPEAK_KEY = 'mednexus.assistant.autospeak'

const REGION_LABELS: Record<string, string> = {
  'en-us': 'English (US)', 'en-gb': 'English (UK)', 'en-in': 'English (India)',
  'en-au': 'English (Australia)', 'en-ca': 'English (Canada)', 'en-ie': 'English (Ireland)',
  'en-za': 'English (South Africa)', 'en-nz': 'English (New Zealand)', 'en-sg': 'English (Singapore)',
}

export function formatVoiceLabel(voice: SpeechSynthesisVoice): string {
  const region = REGION_LABELS[voice.lang.toLowerCase()] ?? voice.lang
  return `${region} — ${voice.name}`
}

/** Browser-native TTS (no cloud cost). Handles the well-known Chrome quirk where
 * speechSynthesis.getVoices() returns [] on the first synchronous call. */
export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURIState] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(VOICE_KEY))
  const [rate, setRateState] = useState<number>(() =>
    typeof window === 'undefined' ? 1 : Number(localStorage.getItem(RATE_KEY)) || 1)
  const [autoSpeak, setAutoSpeakState] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : localStorage.getItem(AUTOSPEAK_KEY) === 'true')

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!supported) return
    function loadVoices() {
      const all = window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('en'))
      if (!all.length) return
      setVoices(all)
      setVoiceURIState(prev => prev && all.some(v => v.voiceURI === prev) ? prev : all[0].voiceURI)
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    const fallback = setTimeout(loadVoices, 300)
    return () => { window.speechSynthesis.onvoiceschanged = null; clearTimeout(fallback) }
  }, [supported])

  function setVoiceURI(uri: string) {
    setVoiceURIState(uri)
    localStorage.setItem(VOICE_KEY, uri)
  }
  function setRate(r: number) {
    setRateState(r)
    localStorage.setItem(RATE_KEY, String(r))
  }
  function setAutoSpeak(v: boolean) {
    setAutoSpeakState(v)
    localStorage.setItem(AUTOSPEAK_KEY, String(v))
  }

  function speak(text: string) {
    if (!supported || !text.trim()) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    const voice = voices.find(v => v.voiceURI === voiceURI)
    if (voice) utter.voice = voice
    utter.rate = rate
    window.speechSynthesis.speak(utter)
  }

  function stop() {
    if (supported) window.speechSynthesis.cancel()
  }

  return { supported, voices, voiceURI, setVoiceURI, rate, setRate, autoSpeak, setAutoSpeak, speak, stop }
}
