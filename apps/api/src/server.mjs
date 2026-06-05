import http from 'node:http';
import { assets, calculateKpis, clients, contractors, createHistoryEvent, incidents, inventory, supervisors, technicians, workOrders } from './domain.mjs';
import { createAiProviderFromEnv } from './ai-provider.mjs';

const port = Number(process.env.PORT ?? 8787);
const aiProvider = createAiProviderFromEnv();

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      response.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
      if (request.method === 'OPTIONS') return sendJson(response, 204, null);

      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (request.method === 'GET' && url.pathname === '/health') return sendJson(response, 200, { ok: true, service: 'GLOBALAPP+IA API', timestamp: new Date().toISOString() });
      if (request.method === 'GET' && url.pathname === '/api/bootstrap') return sendJson(response, 200, { clients, technicians, contractors, supervisors, assets, inventory, incidents, workOrders });
      if (request.method === 'GET' && url.pathname === '/api/kpis') return sendJson(response, 200, calculateKpis({ incidents, workOrders, assets, inventory }));
      if (request.method === 'POST' && url.pathname === '/api/incidents') return createIncident(request, response);
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/work-orders/')) return updateWorkOrder(request, response, url.pathname.split('/').at(-1));
      if (request.method === 'POST' && url.pathname === '/api/sync') return syncWorkOrders(request, response);
      if (request.method === 'POST' && url.pathname.startsWith('/api/ai/report/')) return generateReport(response, url.pathname.split('/').at(-1));
      if (request.method === 'POST' && url.pathname === '/api/ai/diagnose') return diagnose(request, response);
      if (request.method === 'POST' && url.pathname === '/api/ai/chat') return chat(request, response);
      sendJson(response, 404, { message: 'Ruta no encontrada' });
    } catch (error) {
      sendJson(response, 500, { message: error.message });
    }
  });
}

async function createIncident(request, response) {
  const body = await readJson(request);
  const existingIndex = incidents.findIndex((incident) => incident.id === body.id);
  const incident = {
    ...body,
    history: appendHistory(body.history, body.reporterId ?? 'field-user', 'created', 'Incidencia guardada en GLOBALAPP+IA.')
  };
  if (existingIndex >= 0) incidents[existingIndex] = incident;
  else incidents.unshift(incident);
  sendJson(response, 201, incident);
}

async function updateWorkOrder(request, response, id) {
  const body = await readJson(request);
  const index = workOrders.findIndex((order) => order.id === id);
  if (index === -1) return sendJson(response, 404, { message: 'Orden de trabajo no encontrada' });
  workOrders[index] = { ...workOrders[index], ...body, history: appendHistory(body.history ?? workOrders[index].history, 'tec-001', 'sync', 'Orden actualizada desde GLOBALAPP+IA.') };
  sendJson(response, 200, workOrders[index]);
}

async function syncWorkOrders(request, response) {
  const body = await readJson(request);
  const incomingIncidents = body.incidents ?? [];
  for (const incident of incomingIncidents) {
    const index = incidents.findIndex((existing) => existing.id === incident.id);
    const synced = { ...incident, history: appendHistory(incident.history, incident.reporterId ?? 'field-user', 'sync', 'Incidencia offline sincronizada automáticamente.') };
    if (index >= 0) incidents[index] = synced;
    else incidents.unshift(synced);
  }

  const incoming = body.workOrders ?? [];
  for (const order of incoming) {
    const index = workOrders.findIndex((existing) => existing.id === order.id);
    if (index >= 0) workOrders[index] = { ...order, history: appendHistory(order.history, 'tec-001', 'sync', 'Cambios offline sincronizados automáticamente.') };
    else workOrders.unshift({ ...order, history: appendHistory(order.history, 'tec-001', 'sync', 'Orden recibida desde cola offline.') });
  }
  sendJson(response, 200, { accepted: incoming.length + incomingIncidents.length, incidents: incomingIncidents.length, workOrders: incoming.length, serverTime: new Date().toISOString() });
}

async function generateReport(response, workOrderId) {
  const workOrder = workOrders.find((order) => order.id === workOrderId);
  if (!workOrder) return sendJson(response, 404, { message: 'Orden de trabajo no encontrada' });
  const client = clients.find((item) => item.id === workOrder.clientId);
  const asset = assets.find((item) => item.id === workOrder.assetId);
  const contractor = contractors.find((item) => item.id === workOrder.contractorId);
  const report = await aiProvider.generateMaintenanceReport({ workOrder, client, asset, contractor });
  workOrder.aiReport = report;
  workOrder.history = appendHistory(workOrder.history, 'ai', 'ai_report', 'Informe técnico generado por IA.');
  sendJson(response, 200, { report });
}

async function chat(request, response) {
  const body = await readJson(request);
  const answer = await aiProvider.chat({ question: body.question, context: body.context ?? {} });
  sendJson(response, 200, { answer, createdAt: new Date().toISOString() });
}

async function diagnose(request, response) {
  const body = await readJson(request);
  const asset = assets.find((item) => item.id === body.assetId);
  if (!asset) return sendJson(response, 404, { message: 'Activo no encontrado' });
  sendJson(response, 200, await aiProvider.diagnoseFailureFromPhoto({ asset, photoDataUrl: body.photoDataUrl, symptoms: body.symptoms }));
}

function appendHistory(history = [], actorId, type, message) {
  return [...history, createHistoryEvent(actorId, type, message)];
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > 25_000_000) request.destroy(); });
    request.on('end', () => resolve(body ? JSON.parse(body) : {}));
    request.on('error', reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(payload === null ? '' : JSON.stringify(payload));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(port, () => console.log(`GLOBALAPP+IA API escuchando en http://localhost:${port}`));
}
