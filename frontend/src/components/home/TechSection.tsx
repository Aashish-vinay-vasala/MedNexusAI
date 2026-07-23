const techStack = [
  { name: 'React', role: 'Frontend UI', color: '#61DAFB' },
  { name: 'TypeScript', role: 'Type Safety', color: '#3178C6' },
  { name: 'FastAPI', role: 'Backend API', color: '#009688' },
  { name: 'Supabase', role: 'EHR Database', color: '#3ECF8E' },
  { name: 'Firebase', role: 'Realtime + Hosting', color: '#FFCA28' },
  { name: 'Google Cloud', role: 'ML + Storage', color: '#4285F4' },
  { name: 'Groq API', role: 'AI/LLM Engine', color: '#F55036' },
  { name: 'HAPI FHIR', role: 'FHIR R4 Server', color: '#0EA5E9' },
  { name: 'XGBoost', role: 'Risk Models', color: '#F59E0B' },
  { name: 'PyTorch', role: 'Medical Imaging', color: '#EE4C2C' },
  { name: 'Tailwind CSS', role: 'Styling', color: '#38BDF8' },
  { name: 'BigQuery', role: 'Analytics', color: '#4285F4' },
]

export default function TechSection() {
  return (
    <section id="technology" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-4"
            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
            Technology Stack
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">Powered by Industry Leaders</h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#6B7280' }}>
            Open-source and cloud-native tools — fully free tier, production-grade.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {techStack.map(tech => (
            <div key={tech.name} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-default"
              style={{ background: 'rgba(17,24,39,0.8)', border: `1px solid ${tech.color}30` }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${tech.color}60`
                e.currentTarget.style.background = `${tech.color}10`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${tech.color}30`
                e.currentTarget.style.background = 'rgba(17,24,39,0.8)'
              }}>
              <span className="w-2 h-2 rounded-full" style={{ background: tech.color }} />
              <span className="text-sm font-medium text-white">{tech.name}</span>
              <span className="text-xs" style={{ color: '#6B7280' }}>{tech.role}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
