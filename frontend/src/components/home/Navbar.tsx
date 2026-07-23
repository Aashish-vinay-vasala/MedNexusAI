import { Activity, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navLinks = ['Modules', 'Capabilities', 'About']

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(14,165,233,0.15)' }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0EA5E9, #14B8A6)' }}>
            <Activity size={18} color="white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Med<span className="shimmer-text">Nexus</span>AI
          </span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm transition-colors duration-200"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0EA5E9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
              {item}
            </a>
          ))}
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden text-gray-400" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-6 pb-4 flex flex-col gap-4" style={{ background: 'rgba(10,15,30,0.95)' }}>
          {navLinks.map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm py-2"
              style={{ color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              onClick={() => setMenuOpen(false)}>
              {item}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
