import { useState } from 'react'
import { Users, Clock, AlertTriangle, Activity, Search, ChevronRight } from 'lucide-react'
import { useAllPatients, usePatientEvents } from '../hooks/useClinicalData'
import type { Patient } from '../types/clinical'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR = '#8B5CF6'
const CARD_BG = '#111827'
const BORDER = '#1F2937'
const TEXT_SUB = '#9CA3AF'
const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} day${hours >= 48 ? 's' : ''} ago`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientTimelinePage() {
  const patients = useAllPatients()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)

  const filtered = search.trim()
    ? patients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase())
      )
    : patients

  const timelineEvents = usePatientEvents(selected?.id)

  return (
    <div style={{ padding: '24px', minHeight: '100%', background: '#0A0F1E' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${COLOR}18`, border: `1px solid ${COLOR}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={20} color={COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Patient Timeline</h1>
            <p style={{ fontSize: '12px', color: TEXT_SUB, margin: 0 }}>Per-patient clinical event history</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#22C55E', background: '#22C55E14', padding: '3px 8px', borderRadius: '4px', border: '1px solid #22C55E30' }}>LIVE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>

        {/* Patient list */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0A0F1E', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 10px',
            }}>
              <Search size={14} color={TEXT_SUB} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patients…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }}
              />
            </div>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filtered.map(p => {
              const isSelected = selected?.id === p.id
              const rc = RISK_COLOR[p.risk] ?? COLOR
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(isSelected ? null : p)}
                  style={{
                    padding: '12px 16px', borderBottom: `1px solid ${BORDER}60`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                    background: isSelected ? `${COLOR}10` : 'transparent',
                    borderLeft: isSelected ? `3px solid ${COLOR}` : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    background: `${rc}14`, border: `1px solid ${rc}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: rc }}>{p.risk[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: TEXT_SUB }}>{p.id} · {p.ward}</div>
                  </div>
                  {isSelected && <ChevronRight size={14} color={COLOR} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Timeline panel */}
        {!selected ? (
          <div style={{
            background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '400px', gap: '10px',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: `${COLOR}14`, border: `1px solid ${COLOR}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={22} color={COLOR} />
            </div>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500 }}>Select a patient</p>
            <p style={{ fontSize: '13px', color: TEXT_SUB, margin: 0 }}>Choose a patient from the list to view their timeline</p>
          </div>
        ) : (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>

            {/* Patient header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
              background: `${COLOR}08`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: `${RISK_COLOR[selected.risk] ?? COLOR}14`,
                  border: `1px solid ${RISK_COLOR[selected.risk] ?? COLOR}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: RISK_COLOR[selected.risk] ?? COLOR }}>
                    {selected.name[0]}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontSize: '12px', color: TEXT_SUB }}>{selected.id} · Age {selected.age} · {selected.ward} · {selected.status}</div>
                </div>
                <span style={{
                  marginLeft: 'auto', fontSize: '11px', padding: '3px 8px', borderRadius: '5px', fontWeight: 700,
                  color: RISK_COLOR[selected.risk] ?? COLOR,
                  background: `${RISK_COLOR[selected.risk] ?? COLOR}14`,
                  border: `1px solid ${RISK_COLOR[selected.risk] ?? COLOR}28`,
                }}>
                  {selected.risk.toUpperCase()} RISK
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ padding: '20px', maxHeight: '520px', overflowY: 'auto' }}>
              {timelineEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: TEXT_SUB, fontSize: '13px' }}>
                  No recorded events for this patient
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '15px', top: '8px', bottom: '8px', width: '2px',
                    background: `${BORDER}`, borderRadius: '1px',
                  }} />
                  {timelineEvents.map((event, i) => (
                    <div key={event.id} style={{ display: 'flex', gap: '16px', marginBottom: i < timelineEvents.length - 1 ? '20px' : '0' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: `${event.color}18`, border: `2px solid ${event.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                      }}>
                        {event.kind === 'alert'
                          ? <AlertTriangle size={13} color={event.color} />
                          : <Activity size={13} color={event.color} />
                        }
                      </div>
                      <div style={{
                        flex: 1, background: '#0A0F1E', border: `1px solid ${BORDER}`,
                        borderRadius: '10px', padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{event.label}</span>
                          <span style={{
                            fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
                            color: event.kind === 'alert' ? '#F59E0B' : COLOR,
                            background: event.kind === 'alert' ? '#F59E0B14' : `${COLOR}14`,
                          }}>
                            {event.kind.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: TEXT_SUB, marginBottom: '4px' }}>{event.detail}</div>
                        <div style={{ fontSize: '11px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={9} />{timeAgo(event.occurred_at)} · {event.source}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
