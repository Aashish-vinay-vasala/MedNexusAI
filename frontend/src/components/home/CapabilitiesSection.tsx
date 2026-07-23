import { ShieldCheck, Cpu, Wifi, Lock, GitMerge, BarChart2 } from 'lucide-react'

const capabilities = [
  {
    icon: Cpu,
    title: 'AI-Driven Insights',
    desc: 'Groq-powered LLMs for NLP, summarization, and entity extraction across all clinical text.',
    color: '#0EA5E9',
  },
  {
    icon: Wifi,
    title: 'Real-Time Monitoring',
    desc: 'Firebase Firestore streams live vitals and ICU data with sub-second alert delivery via FCM.',
    color: '#14B8A6',
  },
  {
    icon: GitMerge,
    title: 'FHIR R4 Interoperability',
    desc: 'Full HL7 v2/v3 to FHIR R4 conversion with HAPI FHIR server and bundle validation.',
    color: '#8B5CF6',
  },
  {
    icon: BarChart2,
    title: 'Predictive Analytics',
    desc: 'XGBoost and LightGBM models with SHAP explainability for risk scoring and forecasting.',
    color: '#F59E0B',
  },
  {
    icon: Lock,
    title: 'Secure Data Layer',
    desc: 'Supabase PostgreSQL with row-level security and complete audit trails on every record change.',
    color: '#22C55E',
  },
  {
    icon: ShieldCheck,
    title: 'HIPAA-Ready Design',
    desc: 'PHI de-identification via NLP pipeline, encrypted storage, and access-controlled APIs.',
    color: '#EF4444',
  },
]

export default function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      style={{
        width: '100%',
        padding: '7rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '5rem', maxWidth: '640px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '999px', fontSize: '11px',
          fontWeight: 600, letterSpacing: '0.06em', marginBottom: '20px',
          background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', color: '#14B8A6',
        }}>
          PLATFORM CAPABILITIES
        </div>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: '#fff', marginBottom: '16px', lineHeight: 1.2 }}>
          Built for Clinical Scale
        </h2>
        <p style={{ fontSize: '1rem', lineHeight: 1.7, color: '#6B7280' }}>
          Every layer — data, AI, and infrastructure — is purpose-built for healthcare.
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '20px',
        maxWidth: '1280px',
        width: '100%',
      }}>
        {capabilities.map(cap => {
          const Icon = cap.icon
          return (
            <div
              key={cap.title}
              style={{
                flex: '0 0 calc(33.333% - 14px)',
                minWidth: '280px',
                maxWidth: '400px',
                background: 'rgba(10,15,30,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '28px',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${cap.color}35`
                e.currentTarget.style.background = 'rgba(10,15,30,0.95)'
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = `0 16px 48px ${cap.color}14`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.background = 'rgba(10,15,30,0.6)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px',
                background: `${cap.color}15`, border: `1px solid ${cap.color}25`,
              }}>
                <Icon size={22} color={cap.color} />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{cap.title}</h3>
              <p style={{ fontSize: '12px', lineHeight: 1.65, color: '#6B7280', margin: 0 }}>{cap.desc}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
