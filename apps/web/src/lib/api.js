import { clearPendingIncidents, clearPendingWorkOrders, listPendingIncidents, listPendingWorkOrders, savePendingIncident, savePendingWorkOrder } from './offlineStore.js';

async function requestJson(url, init) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const fetchBootstrap = () => requestJson('/api/bootstrap');

export async function saveIncident(incident) {
  if (!navigator.onLine) {
    await savePendingIncident(incident);
    return incident;
  }
  try {
    return await requestJson('/api/incidents', { method: 'POST', body: JSON.stringify(incident) });
  } catch {
    await savePendingIncident(incident);
    return incident;
  }
}

export async function saveWorkOrder(order) {
  if (!navigator.onLine) { await savePendingWorkOrder(order); return order; }
  try { return await requestJson(`/api/work-orders/${order.id}`, { method: 'PATCH', body: JSON.stringify(order) }); }
  catch { await savePendingWorkOrder(order); return order; }
}

export async function syncPendingChanges() {
  const workOrders = await listPendingWorkOrders();
  const incidents = await listPendingIncidents();
  if ((!workOrders.length && !incidents.length) || !navigator.onLine) return { workOrders: 0, incidents: 0 };
  await requestJson('/api/sync', { method: 'POST', body: JSON.stringify({ workOrders, incidents }) });
  await clearPendingWorkOrders();
  await clearPendingIncidents();
  return { workOrders: workOrders.length, incidents: incidents.length };
}

export async function syncPendingWorkOrders() {
  const result = await syncPendingChanges();
  return result.workOrders + result.incidents;
}

export async function generateAiReport(workOrderId) {
  return (await requestJson(`/api/ai/report/${workOrderId}`, { method: 'POST' })).report;
}

export const diagnosePhoto = (assetId, photoDataUrl, symptoms) => requestJson('/api/ai/diagnose', { method: 'POST', body: JSON.stringify({ assetId, photoDataUrl, symptoms }) });
export const askAiAssistant = (question, context = {}) => requestJson('/api/ai/chat', { method: 'POST', body: JSON.stringify({ question, context }) });
