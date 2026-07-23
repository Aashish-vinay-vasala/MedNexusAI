export const CARD_BG = '#111827'
export const BORDER = '#1F2937'
export const TEXT_SUB = '#9CA3AF'

export const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', none: '#22C55E',
}

export const MODE_LABEL: Record<string, string> = {
  pairwise: 'Pairwise Check',
  regimen: 'Regimen Check',
}

export const SOURCE_LABEL: Record<string, string> = {
  curated: 'Curated reference',
  fda_ai: 'AI-analyzed from FDA label',
  unverified: 'Not found in FDA database — unverified',
  none: 'Curated reference',
}

export const COMMON_DRUGS = [
  'Warfarin', 'Aspirin', 'Metformin', 'Lisinopril', 'Amiodarone', 'Digoxin', 'Ibuprofen',
  'Clopidogrel', 'Fluconazole', 'Spironolactone', 'Methotrexate', 'Verapamil', 'Contrast Dye',
  'Potassium', 'Simvastatin', 'Omeprazole', 'Clarithromycin', 'Sildenafil', 'Nitroglycerin', 'Naproxen',
]
