import { askAiAssistant, diagnosePhoto, fetchBootstrap, generateAiReport, saveIncident, saveWorkOrder, syncPendingWorkOrders } from './lib/api.js';
import { calculateKpis } from './lib/kpis.js';
import { printTechnicalPdf } from './lib/pdf.js';
import { applyCompanyTheme, companyConfig } from './config.js';

const SUPPORT_WHATSAPP_NUMBER = companyConfig.supportWhatsAppNumber;
const SUPPORT_MESSAGE = `Hola, necesito soporte técnico de ${companyConfig.tradeName}. Tengo una falla o consulta.`;
const emptyState = { clients: [], technicians: [], contractors: [], supervisors: [], assets: [], inventory: [], incidents: [], workOrders: [] };
let state = structuredClone(emptyState);
let syncMessage = 'Sincronización lista';
let activeDictation = null;
let pendingIncidentGps = null;
let lastVisualDiagnosis = null;
let deferredInstallPrompt = null;
let documents = JSON.parse(localStorage.getItem('globalapp-ia-documents') ?? '[]');
let aiMessages = JSON.parse(localStorage.getItem('globalapp-ia-chat') ?? '[]');
let currentConfig = loadCorporateConfig();
let isPwaInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

async function init() {
  applyCompanyTheme(currentConfig);
  registerServiceWorker();
  bindConnectivitySync();
  bindPwaInstallEvents();
  try {
    state = await fetchBootstrap();
    localStorage.setItem('globalapp-ia-bootstrap', JSON.stringify(state));
  } catch {
    state = JSON.parse(localStorage.getItem('globalapp-ia-bootstrap') ?? JSON.stringify(emptyState));
    syncMessage = 'Modo offline: usando datos locales; los cambios se guardarán en IndexedDB';
  }
  render();
}

function render() {
  const kpis = calculateKpis(state);
  const order = state.workOrders[0];
  document.querySelector('#app').innerHTML = `
    <header class="hero">
      <nav class="topbar">
        <div class="brand-lockup">
          <img class="brand-logo" src="${currentConfig.logoUrl}" alt="Logo ${currentConfig.legalName}" />
          <div>
            <span class="company-name">${currentConfig.legalName}</span>
            <strong>${currentConfig.tradeName}</strong>
          </div>
        </div>
        <div class="top-actions">
          ${renderInstallButton()}
          <span class="status ${navigator.onLine ? 'online' : 'offline'}">${navigator.onLine ? 'Online' : 'Offline'}</span>
        </div>
      </nav>
      <div class="hero-grid">
        <div>
          <span class="eyebrow">Plataforma SaaS industrial</span>
          <h1>${currentConfig.tradeName}</h1>
          <p class="slogan">${currentConfig.slogan}</p>
          <p class="hero-copy">Gestión de incidencias, OTs, técnicos, contratistas, evidencias e IA para operaciones de terreno.</p>
        </div>
        <aside class="hero-card">
          <strong>Centro de operación</strong>
          <small>${syncMessage}</small>
          <div class="hero-actions">
            <button id="heroReportFailure" class="danger-button">Reportar falla</button>
            <button id="heroSupport" class="secondary-button">Soporte técnico</button>
          </div>
        </aside>
      </div>
    </header>
    <section class="panel"><div class="section-title"><span>Dashboard ejecutivo</span><small>KPIs, tendencias, gráficos y ranking de desempeño</small></div><div class="kpi-grid">${renderKpis(kpis)}</div>${renderExecutiveDashboard()}</section>
    <section class="panel module-grid">${['Dashboard','Crear incidencia','Guardar incidencia','Técnicos','Contratistas','GPS','Dictado por voz','Fotos antes/después','Historial','PDF técnico','Offline','IndexedDB','Service Worker','IA mock','Excel','Documentos','ATS','ESG','Configuración','Ayuda'].map((module) => `<article><strong>${module}</strong><small>Funcional bajo marca GlobalTech</small></article>`).join('')}</section>
    <section class="panel">${renderExportPanel()}</section>
    <section class="panel">${renderSustainabilityDashboard()}</section>
    <section class="panel">${renderDocumentLibrary()}</section>
    <section class="panel">${renderAiChat()}</section>
    <section class="panel">${renderAts()}</section>
    <section class="panel">${renderCorporateConfig()}</section>
    <section class="panel">${renderIncidentForm()}</section>
    <section class="panel split-grid">${renderIncidents()}${renderPeople()}</section>
    <section class="panel">${renderHistory()}</section>
    <section class="panel">${renderHelp()}</section>
    <section class="panel"><div class="section-title"><span>Órdenes de trabajo</span><small>Supervisor → técnico → contratista → cliente</small></div><div class="cards">${state.workOrders.map(renderOrder).join('')}</div></section>
    ${order ? renderFieldTools(order) : ''}
    ${renderFloatingSupport()}
    ${renderFooter()}`;
  bindActions();
}

function renderInstallButton() {
  return isPwaInstalled ? '' : '<button id="installApp" class="install-button">Instalar App</button>';
}

function renderFloatingSupport() {
  return `<div class="floating-support" aria-label="Acciones de soporte GlobalTech">
    <button id="floatingReportFailure" class="danger-button">Reportar falla</button>
    <button id="floatingSupport">Soporte técnico</button>
  </div>`;
}

function renderFooter() {
  return `<footer class="legal-footer">Desarrollado por ${currentConfig.legalName} · Derechos reservados © ${new Date().getFullYear()}</footer>`;
}

function renderKpis(kpis) {
  const labels = { openIncidents: 'Incidencias abiertas', activeWorkOrders: 'OT activas', completedToday: 'Completadas hoy', criticalAssets: 'Activos críticos', lowStockItems: 'Repuestos bajo mínimo', mttrHours: 'MTTR horas' };
  return Object.entries(kpis).map(([key, value]) => `<article class="kpi-card"><strong>${value}</strong><span>${labels[key]}</span></article>`).join('');
}

function renderExecutiveDashboard() {
  const closedIncidents = state.incidents.filter((incident) => incident.status === 'closed').length;
  const pendingOrders = state.workOrders.filter((order) => !['completed', 'approved'].includes(order.status)).length;
  const completedOrders = state.workOrders.filter((order) => ['completed', 'approved'].includes(order.status)).length;
  const technicianRanking = rankBy(state.workOrders, 'technicianId', state.technicians, 'name');
  const contractorRanking = rankBy(state.workOrders, 'contractorId', state.contractors, 'companyName');
  const clientRanking = rankBy(state.workOrders, 'clientId', state.clients, 'name');
  const monthly = monthlyTrend();
  return `<div class="executive-grid">
    <article class="kpi-card"><strong>${closedIncidents}</strong><span>Incidencias cerradas</span></article>
    <article class="kpi-card"><strong>${pendingOrders}</strong><span>OTs pendientes</span></article>
    <article class="kpi-card"><strong>${completedOrders}</strong><span>OTs terminadas</span></article>
    <article class="kpi-card"><strong>${currentConfig.legalName.split(' ')[0]}</strong><span>KPI por empresa activo</span></article>
  </div>
  <div class="chart-grid">
    <article class="chart-card"><strong>Tendencias mensuales</strong>${monthly.map((item) => `<div class="bar-row"><span>${item.label}</span><i style="width:${Math.min(100, item.total * 18 + 8)}%"></i><b>${item.total}</b></div>`).join('')}</article>
    <article class="chart-card"><strong>KPI por técnico</strong>${renderRanking(technicianRanking)}</article>
    <article class="chart-card"><strong>KPI por contratista</strong>${renderRanking(contractorRanking)}</article>
    <article class="chart-card"><strong>KPI por cliente</strong>${renderRanking(clientRanking)}</article>
  </div>`;
}

function renderExportPanel() {
  return `<div class="section-title"><span>Exportación de datos</span><small>Excel real compatible con incidencias, OTs, recursos y dashboard</small></div>
    <div class="actions export-actions">
      ${['incidents:Incidencias','workOrders:Órdenes de Trabajo','technicians:Técnicos','contractors:Contratistas','clients:Clientes','kpi:KPI','dashboard:Dashboard Ejecutivo'].map((item) => {
        const [type, label] = item.split(':');
        return `<button data-export="${type}">Excel ${label}</button>`;
      }).join('')}
    </div>`;
}

function renderSustainabilityDashboard() {
  if (!currentConfig.enableEcoKpis) return '<div class="section-title"><span>Dashboard ESG</span><small>KPI ecológicos desactivados para esta empresa</small></div>';
  const esg = calculateEsg();
  return `<div class="section-title"><span>Dashboard ESG · Sostenibilidad</span><small>Impacto positivo de digitalizar mantenimiento</small></div>
    <div class="esg-grid">
      <article><strong>🌳 ${esg.treesProtected}</strong><span>Árboles protegidos</span></article>
      <article><strong>📄 ${esg.sheetsSaved}</strong><span>Hojas ahorradas históricas</span></article>
      <article><strong>♻️ ${esg.positiveImpact}</strong><span>Impacto ambiental positivo</span></article>
      <article><strong>🌎 ${esg.co2AvoidedKg} kg</strong><span>CO2 evitado</span></article>
      <article><strong>📷 ${esg.digitalPhotos}</strong><span>Fotografías digitales</span></article>
      <article><strong>✍️ ${esg.digitalSignatures}</strong><span>Firmas digitales</span></article>
      <article><strong>📑 ${esg.digitalReports}</strong><span>Informes digitales emitidos</span></article>
      <article><strong>${esg.monthlySheets}/${esg.yearlySheets}</strong><span>Hojas mes/año</span></article>
    </div>`;
}

function renderDocumentLibrary() {
  const query = (document.querySelector?.('#docSearch')?.value ?? '').toLowerCase();
  const filtered = documents.filter((doc) => `${doc.name} ${doc.type} ${doc.description}`.toLowerCase().includes(query));
  return `<div class="section-title"><span>Biblioteca documental</span><small>Manuales PDF, planos, procedimientos, fotos, fichas e historial</small></div>
    <form id="documentForm" class="incident-form">
      <label>Nombre<input id="docName" required placeholder="Manual bomba P-204" /></label>
      <label>Tipo<select id="docType"><option>Manual PDF</option><option>Plano</option><option>Procedimiento</option><option>Fotografía técnica</option><option>Ficha técnica</option></select></label>
      <label>Archivo<input id="docFile" type="file" accept=".pdf,image/*,.dwg,.txt,.doc,.docx" /></label>
      <label>Descripción<textarea id="docDescription" placeholder="Uso, activo asociado, versión"></textarea></label>
      <button type="submit">Guardar documento</button>
    </form>
    <label>Búsqueda rápida<input id="docSearch" value="${query}" placeholder="Buscar por nombre, tipo o descripción" /></label>
    <div class="history-list">${filtered.map((doc) => `<div class="list-card"><strong>${doc.name}</strong><small>${doc.type} · ${new Date(doc.createdAt).toLocaleString()}</small><p>${doc.description}</p>${doc.dataUrl ? `<a download="${doc.name}" href="${doc.dataUrl}">Descargar / abrir</a>` : ''}</div>`).join('') || '<small>Sin documentos cargados.</small>'}</div>`;
}

function renderAiChat() {
  return `<div class="section-title"><span>Chat IA interno</span><small>Observaciones, recomendaciones, informes, diagnósticos y consultas operacionales</small></div>
    <div class="chat-box">${aiMessages.map((msg) => `<div class="chat-message ${msg.role}"><strong>${msg.role === 'user' ? 'Usuario' : 'IA GlobalTech'}</strong><p>${msg.content}</p></div>`).join('') || '<small>Haga una consulta operacional para iniciar.</small>'}</div>
    <form id="aiChatForm" class="chat-form"><input id="aiQuestion" placeholder="Ej: genera observaciones técnicas para esta OT" /><button>Enviar a IA</button></form>`;
}

function renderAts() {
  const order = state.workOrders[0] ?? {};
  const ats = order.ats ?? { risks: [], ppe: [], permits: [], checklist: [], signature: '', history: [] };
  return `<div class="section-title"><span>ATS · Análisis de Trabajo Seguro</span><small>Riesgos, EPP, permisos, checklist, firma e historial</small></div>
    <form id="atsForm" class="incident-form">
      <label>Riesgos identificados<textarea id="atsRisks">${ats.risks.join('\n') || 'Energía peligrosa\nCaída al mismo nivel\nProyección de partículas'}</textarea></label>
      <label>EPP requerido<textarea id="atsPpe">${ats.ppe.join('\n') || 'Casco\nLentes\nGuantes\nZapatos de seguridad'}</textarea></label>
      <label>Permisos de trabajo<textarea id="atsPermits">${ats.permits.join('\n') || 'Bloqueo y etiquetado\nPermiso de trabajo en caliente si aplica'}</textarea></label>
      <label>Checklist de seguridad<textarea id="atsChecklist">${ats.checklist.join('\n') || 'Área segregada\nHerramientas verificadas\nSupervisor informado'}</textarea></label>
      <label>Firma conformidad<textarea id="atsSignature">${ats.signature ?? ''}</textarea></label>
      <button>Guardar ATS</button>
    </form>
    <div class="history-list">${(ats.history ?? []).map((event) => `<div class="list-card"><small>${new Date(event.at).toLocaleString()}</small><p>${event.message}</p></div>`).join('') || '<small>Sin historial ATS.</small>'}</div>`;
}

function renderCorporateConfig() {
  return `<div class="section-title"><span>Configuración corporativa multiempresa</span><small>Logo, colores, nombre, eslogan, plantilla PDF, WhatsApp e identidad visual</small></div>
    <form id="configForm" class="incident-form">
      <label>Nombre comercial<input id="cfgTradeName" value="${currentConfig.tradeName}" /></label>
      <label>Empresa<input id="cfgLegalName" value="${currentConfig.legalName}" /></label>
      <label>Eslogan<input id="cfgSlogan" value="${currentConfig.slogan}" /></label>
      <label>Logo URL<input id="cfgLogo" value="${currentConfig.logoUrl}" /></label>
      <label>Color primario<input id="cfgPrimary" type="color" value="${currentConfig.colors.primary}" /></label>
      <label>WhatsApp soporte<input id="cfgWhatsapp" value="${currentConfig.supportWhatsAppNumber}" /></label>
      <label>Plantilla PDF<input id="cfgPdfTitle" value="${currentConfig.pdfTemplate.title}" /></label>
      <label><input id="cfgEco" type="checkbox" ${currentConfig.enableEcoKpis ? 'checked' : ''}/> Activar KPI ecológicos</label>
      <button>Guardar configuración</button>
    </form>`;
}

function renderIncidentForm() {
  return `<div class="section-title"><span>Crear incidencia</span><small>Se guarda online o en IndexedDB si no hay conexión</small></div>
    <form id="incidentForm" class="incident-form">
      <label>Título<input id="incidentTitle" required placeholder="Ej: Fuga, ruido, detención o alarma" /></label>
      <label>Activo<select id="incidentAsset">${state.assets.map((asset) => `<option value="${asset.id}">${asset.tag} · ${asset.name}</option>`).join('') || '<option value="">Sin activos cargados</option>'}</select></label>
      <label>Prioridad<select id="incidentPriority"><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></label>
      <label>Descripción / dictado<textarea id="incidentDescription" placeholder="Describa la falla o dicte desde terreno"></textarea></label>
      <div class="actions"><button type="button" id="dictateIncident">Dictar incidencia</button><button type="button" id="gpsIncident">Capturar GPS</button><button type="submit">Guardar incidencia</button></div>
      <small id="incidentGpsStatus">GPS pendiente</small>
    </form>`;
}

function renderHistory() {
  const incidentEvents = state.incidents.flatMap((incident) => (incident.history ?? []).map((event) => ({ ...event, scope: `Incidencia ${incident.id}` })));
  const orderEvents = state.workOrders.flatMap((order) => (order.history ?? []).map((event) => ({ ...event, scope: `OT ${order.id}` })));
  const events = [...incidentEvents, ...orderEvents].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
  return `<div class="section-title"><span>Historial</span><small>Eventos de incidencias, órdenes, GPS, voz, fotos, sincronización e IA</small></div>
    <div class="history-list">${events.map((event) => `<div class="list-card"><strong>${event.scope}</strong><small>${new Date(event.at).toLocaleString()} · ${event.type} · ${event.actorId}</small><p>${event.message}</p></div>`).join('') || '<small>Sin eventos registrados</small>'}</div>`;
}

function renderHelp() {
  const topics = [
    ['Incidencias', 'Cree una incidencia, seleccione activo, prioridad, describa la falla, capture GPS y guarde. Si no hay conexión, queda en IndexedDB.'],
    ['OTs', 'Revise la orden asignada, complete checklist, registre fotos antes/después, firma, GPS y cierre técnico.'],
    ['Técnicos', 'Consulte responsables GlobalTech, especialidades y disponibilidad para asignación operacional.'],
    ['Contratistas', 'Visualice empresas aprobadas, contacto y especialidades de apoyo en terreno.'],
    ['GPS', 'Use “Capturar GPS” para dejar trazabilidad de la ubicación de incidencia u OT.'],
    ['IA', 'Use “Informe IA” para generar un resumen técnico simulado o conectado a OpenAI/Ollama/LM Studio.'],
    ['Diagnóstico visual', 'Capture o seleccione una foto; la IA entrega diagnóstico probable, criticidad, riesgo, materiales, recomendación y confianza.'],
    ['Informes PDF', 'Use “PDF técnico” para exportar el informe corporativo con logo, fotos, firma, cliente, técnico y recomendaciones.'],
    ['Offline', 'La PWA cachea la interfaz con Service Worker y guarda cambios en IndexedDB para sincronizar al volver internet.'],
    ['Instalación PWA', 'Presione “Instalar App” cuando el navegador lo muestre; el botón desaparece al quedar instalada.']
  ];
  return `<div class="section-title"><span>Ayuda · Manual de usuario</span><small>Guía rápida para técnicos, supervisores y administradores</small></div>
    <div class="help-grid">${topics.map(([title, text], index) => `<details class="help-card" ${index < 2 ? 'open' : ''}><summary>${index + 1}. ${title}</summary><p>${text}</p></details>`).join('')}</div>`;
}

function renderIncidents() {
  return `<article><div class="section-title"><span>Incidencias</span><small>Con GPS, dictado e historial</small></div>${state.incidents.map((incident) => {
    const asset = state.assets.find((item) => item.id === incident.assetId) ?? {};
    return `<div class="list-card"><strong>${incident.title}</strong><p>${asset.tag ?? 'Activo'} · ${incident.priority} · ${incident.status}</p><small>${incident.voiceTranscript ?? 'Sin dictado registrado'}</small>${incident.gps ? `<small>GPS: ${formatGps(incident.gps)}</small>` : ''}</div>`;
  }).join('')}</article>`;
}

function renderPeople() {
  return `<article><div class="section-title"><span>Técnicos y contratistas</span><small>Recursos de terreno GlobalTech</small></div>
    ${state.technicians.map((technician) => `<div class="list-card"><strong>${technician.name}</strong><p>${technician.specialties.join(' · ')}</p><small>${technician.active ? 'Disponible' : 'Inactivo'}</small></div>`).join('')}
    ${state.contractors.map((contractor) => `<div class="list-card contractor"><strong>${contractor.companyName}</strong><p>${contractor.specialties.join(' · ')}</p><small>${contractor.approved ? 'Contratista aprobado' : 'Pendiente aprobación'} · ${contractor.contactName}</small></div>`).join('')}
  </article>`;
}

function renderOrder(order) {
  const client = state.clients.find((item) => item.id === order.clientId) ?? {};
  const asset = state.assets.find((item) => item.id === order.assetId) ?? {};
  const technician = state.technicians.find((item) => item.id === order.technicianId) ?? {};
  const contractor = state.contractors.find((item) => item.id === order.contractorId) ?? {};
  return `<article class="work-card" data-order="${order.id}">
    <div><strong>${order.title}</strong><p>${client.name ?? 'Cliente'} · ${asset.tag ?? 'Activo'} · ${asset.location ?? ''}</p><small>Técnico: ${technician.name ?? 'No asignado'} · Contratista: ${contractor.companyName ?? 'No asignado'}</small></div>
    <span class="badge ${order.status}">${order.status}</span>
    <ul>${order.tasks.map((task) => `<li>${task}</li>`).join('')}</ul>
    <div class="actions"><button data-action="gps">Capturar GPS</button><button data-action="complete">Completar offline</button><button data-action="report">Informe IA</button><button data-action="pdf">PDF técnico</button></div>
    <div class="mini-metrics"><span>${order.evidences.length} evidencias</span><span>${order.gpsTrail?.length ?? 0} GPS</span><span>${order.history?.length ?? 0} historial</span></div>
    ${order.aiReport ? `<pre>${order.aiReport}</pre>` : ''}
  </article>`;
}

function renderFieldTools(order) {
  const asset = state.assets.find((item) => item.id === order.assetId) ?? {};
  return `<section class="panel evidence-panel"><div class="section-title"><span>Herramientas de terreno</span><small>${asset.tag ?? ''} · fotos antes/después · dictado · firma · historial</small></div>
    <div class="evidence-grid">
      <label>Foto antes<input id="beforePhoto" type="file" accept="image/*" capture="environment" /></label>
      <label>Foto después<input id="afterPhoto" type="file" accept="image/*" capture="environment" /></label>
      <label>Foto diagnóstico visual IA<input id="visualDiagnosisPhoto" type="file" accept="image/*" capture="environment" /></label>
      <label>Síntomas / diagnóstico por voz<textarea id="symptoms">${order.diagnosis ?? 'Fuga, ruido o temperatura anormal'}</textarea></label>
      <label>Resolución técnica<textarea id="resolution">${order.resolution ?? ''}</textarea></label>
      <label>Firma digital simple<textarea id="signature" placeholder="Nombre, RUT y conformidad del cliente"></textarea></label>
    </div>
    <div class="actions"><button id="dictateSymptoms">Dictar síntomas</button><button id="dictateResolution">Dictar resolución</button><button id="captureGps">Capturar GPS</button><button id="diagnose">Diagnóstico visual IA</button><button id="saveSignature">Guardar firma</button></div>
    <div class="gps-box"><strong>GPS de intervención</strong>${(order.gpsTrail ?? []).map((point) => `<small>${formatGps(point)}</small>`).join('') || '<small>Sin puntos registrados</small>'}</div>
    <div class="thumbs">${order.evidences.map((evidence) => evidence.dataUrl.startsWith('data:image') ? `<img src="${evidence.dataUrl}" alt="${evidence.kind}" />` : `<small>${evidence.kind}: ${evidence.transcript ?? 'evidencia adjunta'}</small>`).join('')}</div>
    <div class="visual-diagnosis">${renderVisualDiagnosis(order.visualDiagnosis ?? lastVisualDiagnosis)}</div>
    <div class="history"><strong>Historial técnico</strong>${(order.history ?? []).map((event) => `<small>${new Date(event.at).toLocaleString()} · ${event.message}</small>`).join('')}</div>
    <pre id="diagnosis"></pre></section>`;
}

function renderVisualDiagnosis(diagnosis) {
  if (!diagnosis) {
    return '<strong>Diagnóstico visual IA</strong><small>Capture o seleccione una foto y presione “Diagnóstico visual IA”.</small>';
  }
  return `<strong>Diagnóstico visual IA</strong>
    <div class="diagnosis-grid">
      <article><span>Diagnóstico probable</span><strong>${diagnosis.likelyCause ?? 'No determinado'}</strong></article>
      <article><span>Nivel de criticidad</span><strong>${diagnosis.criticalityLevel ?? diagnosis.riskLevel ?? 'medium'}</strong></article>
      <article><span>Riesgo operacional</span><strong>${diagnosis.operationalRisk ?? 'Requiere validación en terreno'}</strong></article>
      <article><span>Confianza</span><strong>${Math.round((diagnosis.confidence ?? 0) * 100)}%</strong></article>
    </div>
    <p><strong>Materiales sugeridos:</strong> ${(diagnosis.suggestedMaterials ?? []).join(', ') || 'Por definir según inspección.'}</p>
    <p><strong>Recomendación técnica:</strong> ${diagnosis.technicalRecommendation ?? diagnosis.recommendedActions?.join(' ') ?? 'Validar con supervisor.'}</p>`;
}

function bindActions() {
  document.querySelectorAll('[data-order]').forEach((card) => {
    const order = state.workOrders.find((item) => item.id === card.dataset.order);
    card.querySelector('[data-action="gps"]').addEventListener('click', () => captureGps(order));
    card.querySelector('[data-action="complete"]').addEventListener('click', () => completeOrder(order));
    card.querySelector('[data-action="report"]').addEventListener('click', () => createReport(order));
    card.querySelector('[data-action="pdf"]').addEventListener('click', () => printTechnicalPdf({ order, client: findClient(order), asset: findAsset(order), technician: findTechnician(order), contractor: findContractor(order), incident: findIncident(order), company: companyConfig }));
  });
  document.querySelector('#beforePhoto')?.addEventListener('change', (event) => addPhoto('before', event.target.files[0]));
  document.querySelector('#afterPhoto')?.addEventListener('change', (event) => addPhoto('after', event.target.files[0]));
  document.querySelector('#diagnose')?.addEventListener('click', runDiagnosis);
  document.querySelector('#saveSignature')?.addEventListener('click', saveSignature);
  document.querySelector('#captureGps')?.addEventListener('click', () => captureGps(state.workOrders[0]));
  document.querySelector('#dictateSymptoms')?.addEventListener('click', () => startDictation('symptoms'));
  document.querySelector('#dictateResolution')?.addEventListener('click', () => startDictation('resolution'));
  document.querySelector('#incidentForm')?.addEventListener('submit', createIncidentFromForm);
  document.querySelector('#dictateIncident')?.addEventListener('click', () => startDictation('incidentDescription'));
  document.querySelector('#gpsIncident')?.addEventListener('click', captureIncidentGps);
  document.querySelector('#installApp')?.addEventListener('click', installApp);
  document.querySelector('#heroSupport')?.addEventListener('click', openSupportWhatsApp);
  document.querySelector('#floatingSupport')?.addEventListener('click', openSupportWhatsApp);
  document.querySelector('#heroReportFailure')?.addEventListener('click', reportFailure);
  document.querySelector('#floatingReportFailure')?.addEventListener('click', reportFailure);
  document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportExcel(button.dataset.export)));
  document.querySelector('#documentForm')?.addEventListener('submit', saveDocument);
  document.querySelector('#docSearch')?.addEventListener('input', render);
  document.querySelector('#aiChatForm')?.addEventListener('submit', askAssistant);
  document.querySelector('#atsForm')?.addEventListener('submit', saveAts);
  document.querySelector('#configForm')?.addEventListener('submit', saveCorporateConfig);
}

function rankBy(rows, key, catalog, labelKey) {
  return catalog.map((item) => {
    const assigned = rows.filter((row) => row[key] === item.id);
    const completed = assigned.filter((row) => ['completed', 'approved'].includes(row.status)).length;
    const score = assigned.length ? Math.round((completed / assigned.length) * 100) : 0;
    return { name: item[labelKey], total: assigned.length, completed, score };
  }).sort((a, b) => b.score - a.score || b.total - a.total);
}

function renderRanking(items) {
  return items.map((item, index) => `<div class="ranking-row"><span>${index + 1}. ${item.name}</span><b>${item.score}%</b><small>${item.completed}/${item.total} terminadas</small></div>`).join('') || '<small>Sin datos.</small>';
}

function monthlyTrend() {
  const months = new Map();
  for (const incident of state.incidents) {
    const label = (incident.reportedAt ?? new Date().toISOString()).slice(0, 7);
    months.set(label, (months.get(label) ?? 0) + 1);
  }
  for (const order of state.workOrders) {
    const label = (order.startedAt ?? order.completedAt ?? new Date().toISOString()).slice(0, 7);
    months.set(label, (months.get(label) ?? 0) + 1);
  }
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([label, total]) => ({ label, total }));
}

function calculateEsg() {
  const digitalReports = state.workOrders.filter((order) => order.aiReport || order.visualDiagnosis || ['completed', 'approved'].includes(order.status)).length;
  const digitalPhotos = state.workOrders.reduce((total, order) => total + order.evidences.filter((evidence) => evidence.dataUrl?.startsWith('data:image')).length, 0);
  const digitalSignatures = state.workOrders.reduce((total, order) => total + order.evidences.filter((evidence) => evidence.kind === 'signature').length, 0);
  const sheetsSaved = digitalReports * 6 + state.incidents.length * 2 + digitalPhotos + digitalSignatures;
  const nowMonth = new Date().toISOString().slice(0, 7);
  const nowYear = new Date().getFullYear().toString();
  const monthlyReports = state.workOrders.filter((order) => (order.completedAt ?? order.startedAt ?? '').startsWith(nowMonth)).length + state.incidents.filter((incident) => incident.reportedAt?.startsWith(nowMonth)).length;
  const yearlyReports = state.workOrders.filter((order) => (order.completedAt ?? order.startedAt ?? '').startsWith(nowYear)).length + state.incidents.filter((incident) => incident.reportedAt?.startsWith(nowYear)).length;
  return {
    digitalReports,
    digitalPhotos,
    digitalSignatures,
    sheetsSaved,
    monthlySheets: monthlyReports * 6,
    yearlySheets: yearlyReports * 6,
    treesProtected: Number((sheetsSaved / 8333).toFixed(3)),
    co2AvoidedKg: Number((sheetsSaved * 0.0045).toFixed(2)),
    positiveImpact: sheetsSaved > 0 ? 'Activo' : 'Inicial'
  };
}

function exportExcel(type) {
  const datasets = buildExportDatasets();
  const selected = type === 'dashboard' ? datasets : { [type]: datasets[type] };
  const sheets = Object.entries(selected).map(([name, rows]) => tableToHtml(name, rows)).join('<br style="page-break-after:always">');
  downloadFile(`globalapp-${type}-${new Date().toISOString().slice(0, 10)}.xls`, `<!doctype html><html><head><meta charset="utf-8"></head><body>${sheets}</body></html>`, 'application/vnd.ms-excel');
}

function buildExportDatasets() {
  const kpis = calculateKpis(state);
  const esg = calculateEsg();
  return {
    incidents: state.incidents,
    workOrders: state.workOrders.map((order) => ({ ...order, evidences: order.evidences.length, history: order.history.length })),
    technicians: state.technicians,
    contractors: state.contractors,
    clients: state.clients,
    kpi: Object.entries({ ...kpis, ...esg }).map(([metric, value]) => ({ metric, value })),
    dashboard: [...Object.entries(kpis).map(([metric, value]) => ({ section: 'Operacional', metric, value })), ...Object.entries(esg).map(([metric, value]) => ({ section: 'ESG', metric, value }))]
  };
}

function tableToHtml(name, rows) {
  const safeRows = rows.length ? rows : [{}];
  const headers = [...new Set(safeRows.flatMap((row) => Object.keys(row)))];
  return `<h2>${name}</h2><table border="1"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${safeRows.map((row) => `<tr>${headers.map((header) => `<td>${formatCell(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function formatCell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value).replaceAll('<', '&lt;');
  return String(value).replaceAll('<', '&lt;');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function saveDocument(event) {
  event.preventDefault();
  const file = document.querySelector('#docFile').files?.[0];
  const dataUrl = file ? await toDataUrl(file) : '';
  const doc = { id: crypto.randomUUID(), name: document.querySelector('#docName').value, type: document.querySelector('#docType').value, description: document.querySelector('#docDescription').value, dataUrl, createdAt: new Date().toISOString(), history: [{ at: new Date().toISOString(), message: 'Documento cargado en biblioteca.' }] };
  documents.unshift(doc);
  localStorage.setItem('globalapp-ia-documents', JSON.stringify(documents));
  render();
}

async function askAssistant(event) {
  event.preventDefault();
  const question = document.querySelector('#aiQuestion').value.trim();
  if (!question) return;
  aiMessages.push({ role: 'user', content: question });
  try {
    const payload = await askAiAssistant(question, { incidents: state.incidents.slice(0, 5), workOrders: state.workOrders.slice(0, 5), kpis: calculateKpis(state) });
    aiMessages.push({ role: 'assistant', content: payload.answer });
  } catch {
    aiMessages.push({ role: 'assistant', content: `IA mock offline: generar observaciones, recomendaciones e informe para: ${question}` });
  }
  localStorage.setItem('globalapp-ia-chat', JSON.stringify(aiMessages.slice(-30)));
  render();
}

async function saveAts(event) {
  event.preventDefault();
  const order = state.workOrders[0];
  if (!order) return;
  const ats = { risks: splitLines('#atsRisks'), ppe: splitLines('#atsPpe'), permits: splitLines('#atsPermits'), checklist: splitLines('#atsChecklist'), signature: document.querySelector('#atsSignature').value, history: [...(order.ats?.history ?? []), { at: new Date().toISOString(), message: 'ATS actualizado con firma/checklist de seguridad.' }] };
  await persistOrder(withHistory({ ...order, ats }, 'signature', 'ATS guardado con permisos, EPP, riesgos y checklist.'));
}

function splitLines(selector) {
  return document.querySelector(selector).value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function saveCorporateConfig(event) {
  event.preventDefault();
  currentConfig = { ...currentConfig, tradeName: document.querySelector('#cfgTradeName').value, legalName: document.querySelector('#cfgLegalName').value, slogan: document.querySelector('#cfgSlogan').value, logoUrl: document.querySelector('#cfgLogo').value, supportWhatsAppNumber: document.querySelector('#cfgWhatsapp').value.replaceAll(' ', '').replace('+', ''), enableEcoKpis: document.querySelector('#cfgEco').checked, colors: { ...currentConfig.colors, primary: document.querySelector('#cfgPrimary').value }, pdfTemplate: { ...currentConfig.pdfTemplate, title: document.querySelector('#cfgPdfTitle').value } };
  localStorage.setItem('globalapp-ia-company-config', JSON.stringify({ ...currentConfig, pdfTemplate: { title: currentConfig.pdfTemplate.title } }));
  applyCompanyTheme(currentConfig);
  render();
}

function loadCorporateConfig() {
  const saved = JSON.parse(localStorage.getItem('globalapp-ia-company-config') ?? 'null');
  const base = { ...companyConfig, colors: { ...companyConfig.colors }, pdfTemplate: { ...companyConfig.pdfTemplate } };
  if (!saved) return base;
  return { ...base, ...saved, colors: { ...base.colors, ...(saved.colors ?? {}) }, pdfTemplate: { ...base.pdfTemplate, ...(saved.pdfTemplate ?? {}) } };
}

async function installApp() {
  if (!deferredInstallPrompt) {
    syncMessage = 'Si el navegador lo permite, use el menú para instalar GLOBALAPP+IA como PWA.';
    render();
    return;
  }
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  if (result.outcome === 'accepted') {
    isPwaInstalled = true;
    deferredInstallPrompt = null;
  }
  render();
}

function openSupportWhatsApp() {
  openWhatsApp(`Hola, necesito soporte técnico de ${currentConfig.tradeName}. Tengo una falla o consulta.`);
}

function reportFailure() {
  const description = window.prompt('Describa brevemente la falla o consulta para soporte técnico:', 'Tengo una falla o consulta en GLOBALAPP+IA.');
  if (description === null) return;
  const ticket = {
    number: `GT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    createdAt: new Date().toISOString(),
    screen: `${window.location.pathname}${window.location.hash || '#dashboard'}`,
    description: description.trim() || 'Sin descripción ingresada',
    status: 'abierto',
    technicalInfo: collectTechnicalInfo()
  };
  const tickets = JSON.parse(localStorage.getItem('globalapp-ia-support-tickets') ?? '[]');
  tickets.unshift(ticket);
  localStorage.setItem('globalapp-ia-support-tickets', JSON.stringify(tickets.slice(0, 50)));
  const summary = [
    `Hola, necesito soporte técnico de ${currentConfig.tradeName}. Tengo una falla o consulta.`,
    `Ticket: ${ticket.number}`,
    `Fecha: ${new Date(ticket.createdAt).toLocaleString()}`,
    `Pantalla actual: ${ticket.screen}`,
    `Descripción: ${ticket.description}`,
    `Estado: ${ticket.status}`,
    `Información técnica: ${ticket.technicalInfo}`
  ].join('\n');
  openWhatsApp(summary);
}

function collectTechnicalInfo() {
  return [`online=${navigator.onLine}`, `url=${window.location.href}`, `ua=${navigator.userAgent}`, `viewport=${window.innerWidth}x${window.innerHeight}`, `sw=${navigator.serviceWorker?.controller ? 'activo' : 'sin-controlador'}`, `incidencias=${state.incidents.length}`, `ots=${state.workOrders.length}`].join(' | ');
}

function openWhatsApp(message) {
  window.open(`https://wa.me/${currentConfig.supportWhatsAppNumber || SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

async function createIncidentFromForm(event) {
  event.preventDefault();
  const asset = state.assets.find((item) => item.id === document.querySelector('#incidentAsset').value) ?? state.assets[0];
  if (!asset) { syncMessage = 'No hay activos disponibles para crear la incidencia'; render(); return; }
  const incident = {
    id: `inc-${Date.now()}`,
    clientId: asset.clientId,
    assetId: asset.id,
    title: document.querySelector('#incidentTitle').value.trim(),
    description: document.querySelector('#incidentDescription').value.trim(),
    priority: document.querySelector('#incidentPriority').value,
    reportedAt: new Date().toISOString(),
    status: 'open',
    gps: pendingIncidentGps,
    voiceTranscript: document.querySelector('#incidentDescription').value.trim(),
    history: [{ id: crypto.randomUUID(), at: new Date().toISOString(), actorId: 'field-user', type: 'created', message: navigator.onLine ? 'Incidencia creada desde la PWA.' : 'Incidencia creada offline y pendiente de sincronización.' }]
  };
  const saved = await saveIncident(incident);
  state.incidents = [saved, ...state.incidents.filter((item) => item.id !== saved.id)];
  pendingIncidentGps = null;
  syncMessage = navigator.onLine ? 'Incidencia guardada en API' : 'Incidencia guardada offline en IndexedDB';
  render();
}

async function captureIncidentGps() {
  pendingIncidentGps = await getCurrentGps();
  document.querySelector('#incidentGpsStatus').textContent = `GPS listo: ${formatGps(pendingIncidentGps)}`;
}

async function completeOrder(order) {
  const updated = withHistory({ ...order, status: 'completed', completedAt: new Date().toISOString(), diagnosis: document.querySelector('#symptoms')?.value ?? order.diagnosis, resolution: document.querySelector('#resolution')?.value || order.resolution || 'Equipo probado y entregado a operaciones.' }, 'completed', 'Orden completada en modo offline-first.');
  await persistOrder(updated);
}

async function createReport(order) {
  const report = await generateAiReport(order.id);
  await persistOrder(withHistory({ ...order, aiReport: report }, 'ai_report', 'Informe técnico IA incorporado a la orden.'));
}

async function addPhoto(kind, file) {
  if (!file) return;
  const order = state.workOrders[0];
  const dataUrl = await toDataUrl(file);
  const gps = await getCurrentGps().catch(() => undefined);
  const evidence = { id: crypto.randomUUID(), kind, dataUrl, gps, capturedAt: new Date().toISOString(), authorId: order.technicianId };
  await persistOrder(withHistory({ ...order, evidences: [...order.evidences, evidence] }, 'photo', `Foto ${kind === 'before' ? 'antes' : 'después'} registrada.`));
}

async function runDiagnosis() {
  const order = state.workOrders[0];
  const selectedPhoto = document.querySelector('#visualDiagnosisPhoto')?.files?.[0];
  const photo = selectedPhoto ? await toDataUrl(selectedPhoto) : order.evidences.find((item) => item.kind === 'before')?.dataUrl;
  if (!photo) {
    document.querySelector('#diagnosis').textContent = 'Seleccione una foto o registre una foto antes para ejecutar el diagnóstico visual IA.';
    return;
  }
  const symptoms = document.querySelector('#symptoms').value;
  const diagnosis = normalizeVisualDiagnosis(await diagnosePhoto(order.assetId, photo, symptoms));
  const technicalReport = buildVisualTechnicalReport(order, diagnosis);
  const visualEvidence = selectedPhoto ? { id: crypto.randomUUID(), kind: 'visual_diagnosis', dataUrl: photo, capturedAt: new Date().toISOString(), authorId: order.technicianId } : null;
  lastVisualDiagnosis = diagnosis;
  const updated = withHistory({
    ...order,
    diagnosis: diagnosis.likelyCause,
    resolution: diagnosis.technicalRecommendation,
    visualDiagnosis: diagnosis,
    aiReport: technicalReport,
    evidences: visualEvidence ? [...order.evidences, visualEvidence] : order.evidences
  }, 'ai_report', 'Diagnóstico visual IA generado y convertido en informe técnico automático.');
  await persistOrder(updated);
}

function normalizeVisualDiagnosis(diagnosis) {
  return {
    likelyCause: diagnosis.likelyCause ?? 'Falla no determinada; requiere inspección presencial.',
    criticalityLevel: diagnosis.criticalityLevel ?? diagnosis.riskLevel ?? 'medium',
    riskLevel: diagnosis.riskLevel ?? diagnosis.criticalityLevel ?? 'medium',
    operationalRisk: diagnosis.operationalRisk ?? 'Riesgo de indisponibilidad, daño secundario o exposición de seguridad si continúa operando.',
    suggestedMaterials: diagnosis.suggestedMaterials ?? ['EPP dieléctrico/mecánico', 'Kit de limpieza industrial', 'Instrumentos de medición', 'Repuesto crítico según activo'],
    technicalRecommendation: diagnosis.technicalRecommendation ?? diagnosis.recommendedActions?.join(' ') ?? 'Detener, aislar, inspeccionar y validar con supervisor antes de reponer servicio.',
    recommendedActions: diagnosis.recommendedActions ?? ['Aislar energía', 'Inspeccionar condición visual', 'Medir variables operacionales', 'Validar reparación con supervisor'],
    confidence: diagnosis.confidence ?? 0.5
  };
}

function buildVisualTechnicalReport(order, diagnosis) {
  return [
    `${companyConfig.pdfTemplate.title} · Diagnóstico visual IA`,
    `Código OT: ${order.id}`,
    `Fecha y hora: ${new Date().toLocaleString()}`,
    `Diagnóstico probable: ${diagnosis.likelyCause}`,
    `Nivel de criticidad: ${diagnosis.criticalityLevel}`,
    `Riesgo operacional: ${diagnosis.operationalRisk}`,
    `Materiales sugeridos: ${diagnosis.suggestedMaterials.join(', ')}`,
    `Recomendación técnica: ${diagnosis.technicalRecommendation}`,
    `Nivel de confianza: ${Math.round(diagnosis.confidence * 100)}%`,
    'Observación: informe generado automáticamente y sujeto a validación del supervisor responsable.'
  ].join('
');
}

async function saveSignature() {
  const order = state.workOrders[0];
  const signature = document.querySelector('#signature').value;
  const dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(signature)))}`;
  const evidence = { id: crypto.randomUUID(), kind: 'signature', dataUrl, capturedAt: new Date().toISOString(), authorId: 'client' };
  await persistOrder(withHistory({ ...order, customerSignature: evidence, evidences: [...order.evidences, evidence] }, 'signature', 'Firma digital simple guardada.'));
}

async function captureGps(order) {
  const point = await getCurrentGps();
  await persistOrder(withHistory({ ...order, gpsTrail: [...(order.gpsTrail ?? []), point] }, 'gps', `GPS capturado: ${formatGps(point)}`));
}

function startDictation(targetId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const target = document.querySelector(`#${targetId}`);
  if (!SpeechRecognition || !target) {
    syncMessage = 'Dictado por voz no soportado en este navegador';
    render();
    return;
  }
  activeDictation?.stop();
  activeDictation = new SpeechRecognition();
  activeDictation.lang = 'es-CL';
  activeDictation.interimResults = false;
  activeDictation.onresult = async (event) => {
    const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ');
    target.value = `${target.value} ${transcript}`.trim();
    if (targetId === 'incidentDescription') return;
    const order = state.workOrders[0];
    const evidence = { id: crypto.randomUUID(), kind: 'voice_note', dataUrl: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(transcript)))}`, transcript, capturedAt: new Date().toISOString(), authorId: order.technicianId };
    await persistOrder(withHistory({ ...order, diagnosis: document.querySelector('#symptoms').value, resolution: document.querySelector('#resolution').value, evidences: [...order.evidences, evidence] }, 'voice_note', `Dictado agregado a ${targetId === 'symptoms' ? 'síntomas' : 'resolución'}.`));
  };
  activeDictation.start();
}

async function persistOrder(order) {
  await saveWorkOrder(order);
  state.workOrders = state.workOrders.map((item) => item.id === order.id ? order : item);
  render();
}

function withHistory(order, type, message) {
  return { ...order, history: [...(order.history ?? []), { id: crypto.randomUUID(), at: new Date().toISOString(), actorId: order.technicianId ?? 'system', type, message }] };
}

function getCurrentGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('GPS no disponible'));
    navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date().toISOString() }), reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
}

function bindPwaInstallEvents() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    isPwaInstalled = false;
    render();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    isPwaInstalled = true;
    render();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', (event) => {
    isPwaInstalled = event.matches;
    render();
  });
}

function bindConnectivitySync() {
  async function refresh() {
    if (navigator.onLine) {
      const synced = await syncPendingWorkOrders();
      syncMessage = synced ? `${synced} cambio(s) sincronizado(s)` : 'Sin cambios pendientes';
      render();
    }
  }
  window.addEventListener('online', refresh);
  window.addEventListener('offline', render);
  window.setInterval(refresh, 30000);
}

function findClient(order) { return state.clients.find((item) => item.id === order.clientId); }
function findAsset(order) { return state.assets.find((item) => item.id === order.assetId); }
function findTechnician(order) { return state.technicians.find((item) => item.id === order.technicianId); }
function findContractor(order) { return state.contractors.find((item) => item.id === order.contractorId); }
function findIncident(order) { return state.incidents.find((item) => item.id === order.incidentId); }
function formatGps(point) { return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} ±${Math.round(point.accuracy ?? 0)}m`; }
function registerServiceWorker() { if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }

init();
