import {
  Shuffle, GitBranch, Brain,
  TrendingUp, Scan,
  Lightbulb, Code2, ShieldAlert,
  BarChart3, UserCheck, Database,
  Pill, Bot, Users2, Receipt, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ModuleNavItem = { id: string; icon: LucideIcon; title: string; color: string }
export type ModuleNavGroup = { label: string; items: ModuleNavItem[] }

/** Single source of truth for the dashboard's routable modules — consumed by DashboardSidebar
 * (nav rendering) and the global assistant widget (page-name subtitle) so the two never drift. */
export const moduleGroups: ModuleNavGroup[] = [
  {
    label: 'INTEROPERABILITY',
    items: [
      { id: 'interop-hub', icon: Shuffle, title: 'Interoperability', color: '#0EA5E9' },
    ],
  },
  {
    label: 'CLINICAL AI',
    items: [
      { id: '3',              icon: GitBranch, title: 'Patient Timeline',                 color: '#8B5CF6' },
      { id: '4',              icon: Brain,     title: 'Clinical NLP & Text Generation',   color: '#F59E0B' },
      { id: '10',             icon: Lightbulb, title: 'Decision Support',                 color: '#F59E0B' },
      { id: '11',             icon: Code2,     title: 'ICD-10 Auto Coding',       color: '#22C55E' },
      { id: 'assistant-hub',  icon: Bot,       title: 'AI Clinical Assistant',    color: '#EC4899' },
    ],
  },
  {
    label: 'RISK & MONITORING',
    items: [
      { id: 'risk-hub',       icon: TrendingUp,  title: 'Risk & Readmission', color: '#EF4444' },
      { id: '9',              icon: Scan,        title: 'Medical Imaging AI', color: '#8B5CF6' },
      { id: 'monitoring-hub', icon: ShieldAlert, title: 'Patient Monitoring', color: '#F59E0B' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { id: '14',               icon: BarChart3, title: 'Resource Forecasting',       color: '#14B8A6' },
      { id: '15',               icon: UserCheck, title: 'Doctor Assignment',          color: '#0EA5E9' },
      { id: 'population-health',icon: Users2,    title: 'Population Health Analytics',color: '#8B5CF6' },
      { id: 'insurance-claims', icon: Receipt,   title: 'Insurance Claims Generator', color: '#F59E0B' },
    ],
  },
  {
    label: 'CORE',
    items: [
      { id: 'patients',  icon: Users2,      title: 'Patient Management',        color: '#0EA5E9' },
      { id: '16',        icon: Database,    title: 'Electronic Health Records', color: '#8B5CF6' },
      { id: '17',        icon: Pill,        title: 'Medical Prescription',      color: '#22C55E' },
      { id: 'audit-log', icon: ShieldCheck, title: 'Audit & Compliance Log',    color: '#8B5CF6' },
    ],
  },
]

const titleById: Record<string, string> = Object.fromEntries(
  moduleGroups.flatMap(g => g.items.map(i => [i.id, i.title]))
)

/** Derives a human page name for the assistant widget's subtitle from a router moduleId
 * (undefined/'overview' => Overview). Falls back to 'Dashboard' for any unrecognized id. */
export function getModuleTitle(moduleId?: string): string {
  if (!moduleId || moduleId === 'overview') return 'Overview'
  return titleById[moduleId] ?? 'Dashboard'
}
