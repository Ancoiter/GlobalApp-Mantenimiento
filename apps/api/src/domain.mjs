export const clients = [{ id: 'cli-001', name: 'Minera Cordillera Norte', rut: '76.123.456-7', contactEmail: 'operaciones@cordillera.example', siteAddress: 'Faena Norte, Antofagasta' }];
export const technicians = [
  { id: 'tec-001', name: 'Camila Rojas', email: 'camila.rojas@globaltech.cl', specialties: ['Mecánica', 'Bombas'], active: true },
  { id: 'tec-002', name: 'Diego Muñoz', email: 'diego.munoz@globaltech.cl', specialties: ['Eléctrica', 'Variadores'], active: true }
];
export const contractors = [
  { id: 'con-001', companyName: 'Andes Mantención Especializada Ltda.', rut: '77.765.432-1', contactName: 'Luis Herrera', contactPhone: '+56 9 5555 0101', specialties: ['Soldadura HDPE', 'Montaje mecánico'], approved: true },
  { id: 'con-002', companyName: 'Norte Servicios Eléctricos SpA', rut: '76.998.120-3', contactName: 'María Vega', contactPhone: '+56 9 5555 0202', specialties: ['Tableros', 'Instrumentación'], approved: true }
];
export const supervisors = [{ id: 'sup-001', name: 'Valentina Torres', email: 'valentina.torres@globaltech.cl', area: 'Mantenimiento Industrial' }];
export const assets = [
  { id: 'act-001', clientId: 'cli-001', tag: 'P-204', name: 'Bomba centrífuga línea ácido', location: 'Planta SX', criticality: 'critical' },
  { id: 'act-002', clientId: 'cli-001', tag: 'CV-18', name: 'Correa transportadora alimentación', location: 'Chancado', criticality: 'high' }
];
export const inventory = [
  { id: 'inv-001', sku: 'SEL-6205', name: 'Sello mecánico 6205', stock: 2, minStock: 3, unit: 'unidad' },
  { id: 'inv-002', sku: 'GRS-EP2', name: 'Grasa EP2 alta temperatura', stock: 14, minStock: 5, unit: 'kg' }
];
export const incidents = [{
  id: 'inc-001', clientId: 'cli-001', assetId: 'act-001', title: 'Fuga visible en sello mecánico', description: 'Operador reporta goteo continuo y aumento de vibración.', priority: 'critical', reportedAt: new Date().toISOString(), status: 'converted',
  gps: { latitude: -23.6509, longitude: -70.3975, accuracy: 35, capturedAt: new Date().toISOString() },
  voiceTranscript: 'Se observa fuga constante en zona de sello y ruido anormal durante operación.',
  history: [{ id: 'his-inc-001', at: new Date().toISOString(), actorId: 'client', type: 'created', message: 'Incidencia creada desde terreno con GPS y dictado.' }]
}];
export const workOrders = [{
  id: 'ot-001', incidentId: 'inc-001', clientId: 'cli-001', assetId: 'act-001', technicianId: 'tec-001', supervisorId: 'sup-001', contractorId: 'con-001', status: 'in_progress',
  title: 'Inspección y reemplazo de sello mecánico P-204', safetyChecklist: ['Bloqueo eléctrico aplicado', 'EPP verificado', 'Área segregada'],
  tasks: ['Inspeccionar fuga', 'Registrar foto antes', 'Capturar GPS de intervención', 'Cambiar sello mecánico', 'Prueba operacional', 'Registrar foto después'], partsUsed: [{ itemId: 'inv-001', quantity: 1 }],
  startedAt: new Date().toISOString(), diagnosis: 'Pendiente de validación final.', gpsTrail: [{ latitude: -23.6509, longitude: -70.3975, accuracy: 35, capturedAt: new Date().toISOString() }], evidences: [],
  history: [
    { id: 'his-ot-001', at: new Date().toISOString(), actorId: 'sup-001', type: 'assigned', message: 'Orden asignada a técnico y contratista aprobado.' },
    { id: 'his-ot-002', at: new Date().toISOString(), actorId: 'tec-001', type: 'gps', message: 'Ubicación inicial registrada en terreno.' }
  ]
}];

export function calculateKpis({ incidents, workOrders, assets, inventory, now = new Date() }) {
  const today = now.toISOString().slice(0, 10);
  const completedOrders = workOrders.filter((order) => order.status === 'completed' || order.status === 'approved');
  const durations = completedOrders
    .filter((order) => order.startedAt && order.completedAt)
    .map((order) => (Date.parse(order.completedAt) - Date.parse(order.startedAt)) / 36e5)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  return {
    openIncidents: incidents.filter((incident) => incident.status !== 'closed').length,
    activeWorkOrders: workOrders.filter((order) => ['assigned', 'in_progress', 'paused'].includes(order.status)).length,
    completedToday: completedOrders.filter((order) => order.completedAt?.startsWith(today)).length,
    criticalAssets: assets.filter((asset) => asset.criticality === 'critical').length,
    lowStockItems: inventory.filter((item) => item.stock <= item.minStock).length,
    mttrHours: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)) : 0
  };
}

export function createHistoryEvent(actorId, type, message) {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), actorId, type, message };
}

