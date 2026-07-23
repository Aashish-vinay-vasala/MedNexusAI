export const CARD_BG = '#111827'
export const BORDER = '#1F2937'
export const TEXT_SUB = '#9CA3AF'
export const RISK_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', low: '#22C55E' }
export const ENTITY_COLORS: Record<string, string> = {
  CONDITION: '#EF4444',
  MEDICATION: '#8B5CF6',
  PROCEDURE: '#0EA5E9',
  SYMPTOM: '#F59E0B',
  VITAL: '#EC4899',
}
export const STATUS_COLOR: Record<string, string> = { normal: '#22C55E', high: '#F59E0B', low: '#0EA5E9', critical: '#EF4444' }

export const MODE_LABEL: Record<string, string> = {
  nlp_analyze: 'NLP Entity Analysis',
  note_summary: 'Note Summary',
  report_summary: 'Report Summary',
  discharge_letter: 'Discharge Letter',
}
