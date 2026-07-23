import { useEffect, useRef, useState } from 'react'

const stats = [
  { value: 2847, suffix: '+', label: 'Patients Tracked', color: '#0EA5E9' },
  { value: 97.3, suffix: '%', label: 'AI Diagnostic Accuracy', color: '#14B8A6', decimal: true },
  { value: 16, suffix: '', label: 'Integrated Modules', color: '#8B5CF6' },
  { value: 1.2, suffix: 's', label: 'Avg Alert Response', color: '#22C55E', decimal: true },
]

function useCountUp(target: number, duration: number, decimal: boolean, start: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(parseFloat((progress * target).toFixed(decimal ? 1 : 0)))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration, decimal])
  return count
}

function StatCard({ value, suffix, label, color, decimal }: typeof stats[0]) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const count = useCountUp(value, 2000, !!decimal, visible)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="text-center p-8 rounded-2xl"
      style={{ background: 'rgba(17,24,39,0.6)', border: `1px solid ${color}20` }}>
      <div className="text-5xl font-bold mb-2" style={{ color }}>
        {decimal ? count.toFixed(1) : Math.round(count)}{suffix}
      </div>
      <div className="text-sm" style={{ color: '#6B7280' }}>{label}</div>
    </div>
  )
}

export default function StatsSection() {
  return (
    <section className="w-full py-20 px-6">
      <div className="max-w-5xl mx-auto flex justify-center">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      </div>
    </section>
  )
}
