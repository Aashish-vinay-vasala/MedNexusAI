import { Shield, Zap, Activity } from 'lucide-react'
import ECGAnimation from './ECGAnimation'

interface HeroSectionProps {
  onEnter: () => void
}

export default function HeroSection({ onEnter }: HeroSectionProps) {
  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden" id="enter">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-175 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-100 h-100 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 70%)' }} />
      </div>

      {/* Main content — fully centered */}
      <div className="relative z-10 w-full flex flex-col items-center text-center px-6">

        {/* Top badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-10"
          style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.22)', color: '#0EA5E9', letterSpacing: '0.04em' }}>
          <Activity size={11} />
          AI-Powered Healthcare Intelligence Platform
        </div>

        {/* Brand title */}
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4 leading-none">
          <span className="text-white">Med</span><span className="shimmer-text">Nexus</span><span className="text-white">AI</span>
        </h1>

        {/* Description */}
        <p className="text-base md:text-lg mb-10 max-w-lg leading-relaxed" style={{ color: '#6B7280' }}>
          Unified AI platform integrating FHIR, NLP, predictive analytics,
          and real-time monitoring to transform patient care.
        </p>

        {/* ECG */}
        <div className="w-full max-w-lg mb-10">
          <ECGAnimation />
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
          {[
            { icon: Shield, label: 'HIPAA Compliant' },
            { icon: Zap,    label: 'Real-time Analytics' },
            { icon: Activity, label: 'HL7 & FHIR R4' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm" style={{ color: '#4B5563' }}>
              <Icon size={14} style={{ color: '#14B8A6' }} />
              {label}
            </div>
          ))}
        </div>

        {/* Enter button */}
        <div className="flex items-center justify-center" style={{ marginTop: '2rem' }}>
          <button
            onClick={onEnter}
            className="px-16 py-5 rounded-2xl font-semibold text-lg text-white whitespace-nowrap transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #0EA5E9, #14B8A6)', boxShadow: '0 0 36px rgba(14,165,233,0.3)', minWidth: '220px' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 56px rgba(14,165,233,0.55)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 36px rgba(14,165,233,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}>
            Enter Platform
          </button>
        </div>

      </div>
    </section>
  )
}
