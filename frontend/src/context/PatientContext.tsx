import { createContext, useContext, useState } from 'react'
import type { Patient } from '../types/clinical'

type PatientContextType = {
  selectedPatient: Patient | null
  setSelectedPatient: (p: Patient | null) => void
}

const PatientContext = createContext<PatientContextType>({
  selectedPatient: null,
  setSelectedPatient: () => {},
})

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  return (
    <PatientContext.Provider value={{ selectedPatient, setSelectedPatient }}>
      {children}
    </PatientContext.Provider>
  )
}

export function usePatientContext() {
  return useContext(PatientContext)
}
