import { Activity } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0EA5E9, #14B8A6)' }}>
            <Activity size={15} color="white" />
          </div>
          <span className="text-white font-semibold">MedNexusAI</span>
        </div>

        <p className="text-sm text-center" style={{ color: '#374151' }}>
          AI-powered healthcare intelligence — built for clinicians, powered by open standards.
        </p>

        <div className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          All systems operational
        </div>
      </div>
    </footer>
  )
}
