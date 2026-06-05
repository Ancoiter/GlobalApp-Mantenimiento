export type Role = 'admin' | 'supervisor' | 'technician' | 'contractor' | 'client';
export type WorkOrderStatus = 'draft' | 'assigned' | 'in_progress' | 'paused' | 'completed' | 'approved';
export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceKind = 'before' | 'after' | 'signature' | 'gps' | 'voice_note' | 'visual_diagnosis';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
}

export interface HistoryEvent {
  id: string;
  at: string;
  actorId: string;
  type: 'created' | 'assigned' | 'gps' | 'voice_note' | 'photo' | 'signature' | 'sync' | 'completed' | 'ai_report';
  message: string;
}

export interface Client {
  id: string;
  name: string;
  rut: string;
  contactEmail: string;
  siteAddress: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  specialties: string[];
  active: boolean;
}

export interface Contractor {
  id: string;
  companyName: string;
  rut: string;
  contactName: string;
  contactPhone: string;
  specialties: string[];
  approved: boolean;
}

export interface Supervisor {
  id: string;
  name: string;
  email: string;
  area: string;
}

export interface Asset {
  id: string;
  clientId: string;
  tag: string;
  name: string;
  location: string;
  criticality: IncidentPriority;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
}

export interface Incident {
  id: string;
  clientId: string;
  assetId: string;
  title: string;
  description: string;
  priority: IncidentPriority;
  reportedAt: string;
  status: 'open' | 'triaged' | 'converted' | 'closed';
  gps?: GeoPoint;
  voiceTranscript?: string;
  history: HistoryEvent[];
}

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  dataUrl: string;
  capturedAt: string;
  authorId: string;
  gps?: GeoPoint;
  transcript?: string;
}

export interface WorkOrder {
  id: string;
  incidentId?: string;
  clientId: string;
  assetId: string;
  technicianId: string;
  supervisorId: string;
  contractorId?: string;
  status: WorkOrderStatus;
  title: string;
  safetyChecklist: string[];
  tasks: string[];
  partsUsed: Array<{ itemId: string; quantity: number }>;
  startedAt?: string;
  completedAt?: string;
  diagnosis?: string;
  resolution?: string;
  gpsTrail: GeoPoint[];
  evidences: Evidence[];
  history: HistoryEvent[];
  customerSignature?: Evidence;
  visualDiagnosis?: AiDiagnosis;
  aiReport?: string;
}

export interface DashboardKpis {
  openIncidents: number;
  activeWorkOrders: number;
  completedToday: number;
  criticalAssets: number;
  lowStockItems: number;
  mttrHours: number;
}

export interface AiReportRequest {
  workOrder: WorkOrder;
  client: Client;
  asset: Asset;
  contractor?: Contractor;
}

export interface AiDiagnosisRequest {
  asset: Asset;
  photoDataUrl: string;
  symptoms: string;
}

export interface AiDiagnosis {
  likelyCause: string;
  criticalityLevel?: IncidentPriority;
  operationalRisk?: string;
  suggestedMaterials?: string[];
  technicalRecommendation?: string;
  recommendedActions: string[];
  riskLevel: IncidentPriority;
  confidence: number;
}

export function calculateKpis(input: {
  incidents: Incident[];
  workOrders: WorkOrder[];
  assets: Asset[];
  inventory: InventoryItem[];
  now?: Date;
}): DashboardKpis {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const completedOrders = input.workOrders.filter((order) => order.status === 'completed' || order.status === 'approved');
  const durations = completedOrders
    .filter((order) => order.startedAt && order.completedAt)
    .map((order) => (Date.parse(order.completedAt!) - Date.parse(order.startedAt!)) / 36e5)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);

  return {
    openIncidents: input.incidents.filter((incident) => incident.status !== 'closed').length,
    activeWorkOrders: input.workOrders.filter((order) => ['assigned', 'in_progress', 'paused'].includes(order.status)).length,
    completedToday: completedOrders.filter((order) => order.completedAt?.startsWith(today)).length,
    criticalAssets: input.assets.filter((asset) => asset.criticality === 'critical').length,
    lowStockItems: input.inventory.filter((item) => item.stock <= item.minStock).length,
    mttrHours: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)) : 0
  };
}
