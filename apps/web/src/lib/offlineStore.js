const DB_NAME = 'globalapp-ia-offline';
const DB_VERSION = 2;
const STORES = {
  workOrders: 'pendingWorkOrders',
  incidents: 'pendingIncidents'
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      for (const storeName of Object.values(STORES)) {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, value) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export const savePendingWorkOrder = (order) => put(STORES.workOrders, order);
export const listPendingWorkOrders = () => getAll(STORES.workOrders);
export const clearPendingWorkOrders = () => clear(STORES.workOrders);
export const savePendingIncident = (incident) => put(STORES.incidents, incident);
export const listPendingIncidents = () => getAll(STORES.incidents);
export const clearPendingIncidents = () => clear(STORES.incidents);
