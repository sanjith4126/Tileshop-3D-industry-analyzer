// Mirrors backend DTOs (camelCase JSON, enums as strings).

export type MachineStatus = 'Normal' | 'Warning' | 'Critical' | 'Offline' | 'Unknown'
export type DataOrigin = 'Synthetic' | 'Real'
export type SensorState = 'Normal' | 'Warning' | 'Critical' | 'Missing'

export interface MachineSummary {
  id: string
  name: string
  typeId: string
  typeName: string
  zoneId: string
  zoneName: string
  status: MachineStatus
  statusReasons: string[]
  maintenanceStatus: string
  isFlaggedOffline: boolean
  manufacturer: string
  model: string
  dataOrigin: DataOrigin
  lastReadingUtc: string | null
  openAlertCount: number
}

export interface Sensor {
  id: string
  measurement: string
  unit: string
  isRequired: boolean
  warningMin: number | null
  warningMax: number | null
  criticalMin: number | null
  criticalMax: number | null
  latestValue: number | null
  latestTimestampUtc: string | null
  state: SensorState
}

export interface MaintenanceRecord {
  id: string
  machineId: string
  type: string
  description: string
  performedBy: string | null
  performedUtc: string
  durationHours: number
  outcome: string | null
  dataOrigin: DataOrigin
}

export interface MachineDetail {
  machine: MachineSummary
  sensors: Sensor[]
  recentMaintenance: MaintenanceRecord[]
}

export interface Zone {
  id: string
  name: string
  description: string | null
  machineCount: number
  statusCounts: Partial<Record<MachineStatus, number>>
  dataOrigin: DataOrigin
}

export interface Health {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unavailable'
  demoData: { seedBatchId: string; anchorUtc: string; seededUtc: string } | null
  features: { ai: boolean; embeddings: boolean; mlServiceUrl: string; devUsers: boolean }
  timestampUtc: string
}

export type AlertSeverity = 'Warning' | 'Critical'
export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved'

export interface AlertHistory {
  newStatus: AlertStatus
  userName: string
  comment: string | null
  timestampUtc: string
}

export interface Alert {
  id: string
  machineId: string
  machineName: string
  sensorId: string
  measurement: string
  unit: string
  severity: AlertSeverity
  observedValue: number
  threshold: number
  detectedUtc: string
  status: AlertStatus
  resolvedUtc: string | null
  dataOrigin: DataOrigin
  history: AlertHistory[]
}

export interface SeriesPoint {
  t: string
  avg: number
  min: number
  max: number
}

export interface SensorSeries {
  sensorId: string
  measurement: string
  unit: string
  warningMin: number | null
  warningMax: number | null
  criticalMin: number | null
  criticalMax: number | null
  points: SeriesPoint[]
}

export type ReadingsRange = '1h' | '24h' | '7d'

export interface ReadingsResponse {
  machineId: string
  range: ReadingsRange
  fromUtc: string
  toUtc: string
  bucketSeconds: number
  dataOrigin: DataOrigin
  sensors: SensorSeries[]
}

export type ObservationStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed'
export type ObservationPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface InspectionZone {
  id: string
  name: string
  total: number
  open: number
  openHighPriority: number
}

export interface ObservationSummary {
  id: string
  code: string
  zoneId: string
  zoneName: string
  machineId: string | null
  category: string
  priority: ObservationPriority
  status: ObservationStatus
  description: string
  assignedRole: string | null
  assignedUser: string | null
  createdUtc: string
  updatedUtc: string
  openActions: number
  dataOrigin: DataOrigin
}

export interface ObservationDetail {
  observation: ObservationSummary
  inspectionTitle: string
  inspectorName: string | null
  inspectionUtc: string
  correctiveActions: { id: string; description: string; status: string; assignedRole: string | null; createdUtc: string; dueUtc: string | null; completedUtc: string | null; overdue: boolean }[]
  attachments: { id: string; fileName: string; caption: string; isPlaceholder: boolean; url: string }[]
  history: { timestampUtc: string; userName: string; action: string; details: string | null }[]
}

export interface InspectionSummary {
  scope: string
  generatedUtc: string
  total: number
  byStatus: Record<ObservationStatus, number>
  openByPriority: Record<ObservationPriority, number>
  openHighPriority: { code: string; id: string; zoneId: string; machineId: string | null; priority: ObservationPriority; status: ObservationStatus; description: string }[]
  overdueActions: number
  lines: string[]
  focusEntityIds: string[]
  containsSyntheticData: boolean
}
