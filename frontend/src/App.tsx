import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import { PatientProvider } from './context/PatientContext'
import { AssistantProvider } from './context/AssistantContext'
import GlobalAssistantWidget from './components/assistant/GlobalAssistantWidget'

export default function App() {
  return (
    <BrowserRouter>
      <PatientProvider>
        <AssistantProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/:moduleId" element={<DashboardPage />} />
          </Routes>
          <GlobalAssistantWidget />
        </AssistantProvider>
      </PatientProvider>
    </BrowserRouter>
  )
}
