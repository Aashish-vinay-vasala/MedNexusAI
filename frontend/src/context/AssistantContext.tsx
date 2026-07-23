import { createContext, useContext, useRef, useState } from 'react'

export type AssistantSource = { title: string; url: string; snippet: string; favicon: string }
export type AssistantMessage = { role: 'user' | 'assistant' | 'error'; text: string; sources?: AssistantSource[] }
export type PanelSize = 'compact' | 'default' | 'maximized'

type AssistantContextType = {
  open: boolean
  setOpen: (open: boolean) => void
  panelSize: PanelSize
  setPanelSize: (size: PanelSize) => void
  deviceId: string
  sessionId: number | null
  setSessionId: (id: number | null) => void
  messages: AssistantMessage[]
  setMessages: React.Dispatch<React.SetStateAction<AssistantMessage[]>>
  asking: boolean
  setAsking: (asking: boolean) => void
  webSearch: boolean
  setWebSearch: (v: boolean) => void
  newChat: () => void
}

const AssistantContext = createContext<AssistantContextType | null>(null)

const DEVICE_ID_KEY = 'mednexus.assistant.device_id'

/** Exported so any page that talks to /api/v1/assistant/chat directly (e.g. the patient-scoped
 * ChatAssistantPage) can reuse the same device_id the global widget uses for history scoping. */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [panelSize, setPanelSize] = useState<PanelSize>('default')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const deviceIdRef = useRef<string | null>(null)
  if (!deviceIdRef.current) deviceIdRef.current = getOrCreateDeviceId()

  function newChat() {
    setSessionId(null)
    setMessages([])
  }

  return (
    <AssistantContext.Provider value={{
      open, setOpen, panelSize, setPanelSize, deviceId: deviceIdRef.current,
      sessionId, setSessionId, messages, setMessages, asking, setAsking,
      webSearch, setWebSearch, newChat,
    }}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistantContext() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistantContext must be used within AssistantProvider')
  return ctx
}
