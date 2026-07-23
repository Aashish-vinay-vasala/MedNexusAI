import { useNavigate } from 'react-router-dom'
import Navbar from '../components/home/Navbar'
import HeroSection from '../components/home/HeroSection'
import ModulesSection from '../components/home/ModulesSection'
import CapabilitiesSection from '../components/home/CapabilitiesSection'
import Footer from '../components/home/Footer'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#0A0F1E' }}>
      <Navbar />
      <main>
        <HeroSection onEnter={() => navigate('/dashboard')} />
        <ModulesSection />
        <CapabilitiesSection />
      </main>
      <Footer />
    </div>
  )
}
