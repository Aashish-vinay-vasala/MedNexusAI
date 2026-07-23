export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info'

export const severityColor: Record<AlertSeverity, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#0EA5E9', info: '#6B7280',
}

export const severityLabel: Record<AlertSeverity, string> = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', info: 'INFO',
}

export const severityOrder: Record<AlertSeverity, number> = {
  critical: 0, high: 1, medium: 2, info: 3,
}
