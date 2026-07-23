import {
  ArrowLeftRight, LayoutDashboard, GitBranch, Brain,
  TrendingUp, Users, RefreshCw, Scan,
  Lightbulb, Code2, Activity, AlertTriangle,
  BarChart3, UserCheck, Database
} from 'lucide-react'

const modules = [
  { id: 1,  icon: ArrowLeftRight,  title: 'HL7 → FHIR Converter',          desc: 'Parse HL7 v2/v3 messages and map to FHIR R4 resources with full bundle validation.',            color: '#0EA5E9', tag: 'Interoperability' },
  { id: 2,  icon: LayoutDashboard, title: 'FHIR Data Explorer',             desc: 'Query the FHIR server via REST, filter by patient or date, and visualize labs and vitals.',     color: '#14B8A6', tag: 'Analytics'        },
  { id: 3,  icon: GitBranch,       title: 'Patient Timeline Builder',       desc: 'Aggregate encounters, diagnoses, and procedures into a chronological patient view.',             color: '#8B5CF6', tag: 'Clinical'         },
  { id: 4,  icon: Brain,           title: 'Clinical NLP & Text Generation', desc: 'Entity recognition and negation detection, plus AI note/report summarization and discharge letters.', color: '#F59E0B', tag: 'AI / NLP'        },
  { id: 6,  icon: TrendingUp,      title: 'Clinical Risk Prediction',       desc: 'XGBoost and LightGBM risk models with SHAP explainability for transparent scoring.',            color: '#EF4444', tag: 'ML'              },
  { id: 7,  icon: Users,           title: 'Patient Risk Profiling',         desc: 'Pull structured EHR data — labs, vitals, history — to predict chronic condition onset.',         color: '#0EA5E9', tag: 'ML'              },
  { id: 8,  icon: RefreshCw,       title: 'Readmission Prediction',         desc: 'Estimate 30-day readmission probability and length of stay at the point of admission.',         color: '#14B8A6', tag: 'ML'              },
  { id: 9,  icon: Scan,            title: 'Medical Imaging AI',             desc: 'DICOM preprocessing and CNN-based classification with confidence-scored finding reports.',       color: '#8B5CF6', tag: 'Imaging'         },
  { id: 10, icon: Lightbulb,       title: 'Clinical Decision Support',      desc: 'Surface treatment recommendations, drug interaction alerts, and guideline matches per patient.',  color: '#F59E0B', tag: 'CDSS'           },
  { id: 11, icon: Code2,           title: 'ICD-10 Auto Coding',             desc: 'Extract diagnoses from free text and map to validated ICD-10 codes against payer rules.',       color: '#22C55E', tag: 'Coding'          },
  { id: 12, icon: Activity,        title: 'ICU Patient Monitoring',         desc: 'Ingest real-time vitals streams, detect deterioration patterns, and trigger staff alerts.',      color: '#EF4444', tag: 'Monitoring'      },
  { id: 13, icon: AlertTriangle,   title: 'Sepsis Early Warning',           desc: 'Monitor SIRS criteria and qSOFA scores — alert the care team with graded severity.',            color: '#F59E0B', tag: 'Alerts'          },
  { id: 14, icon: BarChart3,       title: 'Hospital Resource Forecasting',  desc: 'Predict daily bed occupancy, staffing needs, and supply usage to optimize patient flow.',       color: '#14B8A6', tag: 'Operations'      },
  { id: 15, icon: UserCheck,       title: 'Doctor Assignment & Routing',    desc: 'AI-based specialist matching from NLP and imaging output with automated assignment.',           color: '#0EA5E9', tag: 'Workflow'        },
  { id: 16, icon: Database,        title: 'Electronic Health Records',      desc: 'Central EHR with full CRUD, role-based access control, audit logs, and module integration.',    color: '#8B5CF6', tag: 'Core'            },
]

export default function ModulesSection() {
  return (
    <section
      id="modules"
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
          background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9',
        }}>
          15 INTEGRATED MODULES
        </div>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: '#fff', marginBottom: '16px', lineHeight: 1.2 }}>
          Complete Clinical AI Suite
        </h2>
        <p style={{ fontSize: '1rem', lineHeight: 1.7, color: '#6B7280' }}>
          Every module is standalone yet deeply integrated — powered by real data, zero hardcoding.
        </p>
      </div>

      {/* Cards — flex wrap so incomplete last row is centered */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '20px',
        maxWidth: '1280px',
        width: '100%',
      }}>
        {modules.map((mod) => {
          const Icon = mod.icon
          return (
            <div
              key={mod.id}
              style={{
                flex: '0 0 calc(33.333% - 14px)',
                minWidth: '280px',
                maxWidth: '400px',
                background: 'rgba(10,15,30,0.7)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                gap: '20px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${mod.color}35`
                e.currentTarget.style.background = 'rgba(10,15,30,0.95)'
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = `0 16px 48px ${mod.color}14`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.background = 'rgba(10,15,30,0.7)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Left col: icon + number */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${mod.color}12`, border: `1px solid ${mod.color}28`,
                }}>
                  <Icon size={20} color={mod.color} />
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#1F2937' }}>
                  {String(mod.id).padStart(2, '0')}
                </span>
              </div>

              {/* Right col: content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', lineHeight: 1.4, margin: 0 }}>{mod.title}</h3>
                  <span style={{
                    flexShrink: 0, fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                    fontWeight: 500, background: `${mod.color}12`, color: mod.color, border: `1px solid ${mod.color}22`,
                    whiteSpace: 'nowrap',
                  }}>
                    {mod.tag}
                  </span>
                </div>
                <p style={{ fontSize: '12px', lineHeight: 1.65, color: '#6B7280', margin: 0 }}>{mod.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                  <span style={{ fontSize: '11px', color: '#374151' }}>Active</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
