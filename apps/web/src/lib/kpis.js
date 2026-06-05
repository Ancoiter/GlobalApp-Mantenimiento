export function calculateKpis({ incidents, workOrders, assets, inventory }) {
  const today = new Date().toISOString().slice(0, 10);
  const completedOrders = workOrders.filter((order) => order.status === 'completed' || order.status === 'approved');
  const durations = completedOrders.filter((order) => order.startedAt && order.completedAt).map((order) => (Date.parse(order.completedAt) - Date.parse(order.startedAt)) / 36e5).filter((hours) => Number.isFinite(hours) && hours >= 0);
  return {
    openIncidents: incidents.filter((incident) => incident.status !== 'closed').length,
    activeWorkOrders: workOrders.filter((order) => ['assigned', 'in_progress', 'paused'].includes(order.status)).length,
    completedToday: completedOrders.filter((order) => order.completedAt?.startsWith(today)).length,
    criticalAssets: assets.filter((asset) => asset.criticality === 'critical').length,
    lowStockItems: inventory.filter((item) => item.stock <= item.minStock).length,
    mttrHours: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)) : 0
  };
}
