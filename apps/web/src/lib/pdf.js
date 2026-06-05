import { companyConfig } from '../config.js';

export function printTechnicalPdf({ order, client, asset, technician, contractor, incident, company = companyConfig }) {
  const beforePhotos = order.evidences.filter((evidence) => evidence.kind === 'before' || evidence.kind === 'visual_diagnosis');
  const afterPhotos = order.evidences.filter((evidence) => evidence.kind === 'after');
  const signature = order.customerSignature ?? order.evidences.find((evidence) => evidence.kind === 'signature');
  const generatedAt = new Date();
  const observations = order.diagnosis ?? incident?.description ?? 'Sin observaciones registradas.';
  const recommendations = order.visualDiagnosis?.technicalRecommendation ?? order.aiReport ?? 'Validar condición final con supervisor y cliente.';
  const footer = company.pdfTemplate.footer(generatedAt.getFullYear());

  const html = `
    <html lang="es">
      <head>
        <title>${company.pdfTemplate.title} ${order.id}</title>
        <style>
          @page { margin: 18mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #172033; line-height: 1.55; }
          header { display: flex; align-items: center; gap: 18px; border-bottom: 5px solid ${company.colors.primary}; margin-bottom: 22px; padding-bottom: 14px; }
          .logo { width: 150px; height: 92px; object-fit: contain; }
          h1 { color: ${company.colors.primary}; margin: 0; font-size: 28px; }
          h2 { color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          p { text-align: justify; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; margin-bottom: 12px; background: #f8fafc; }
          .box strong { color: #0f172a; }
          .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          figure { margin: 0; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px; background: white; }
          img.photo { width: 100%; max-height: 250px; object-fit: contain; border-radius: 8px; }
          .signature { max-width: 360px; white-space: pre-wrap; background: white; }
          .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 12px; text-align: center; }
          small { display: block; color: #64748b; margin: 4px 0; }
          pre { white-space: pre-wrap; text-align: justify; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <header><img class="logo" src="${company.logoUrl}" alt="Logo ${company.legalName}" /><div><h1>${company.pdfTemplate.title}</h1><strong>${company.tradeName}</strong><small>${company.legalName}</small><small>Fecha y hora: ${generatedAt.toLocaleString()}</small></div></header>
        <section class="grid">
          <div class="box"><strong>Cliente</strong><br>${client?.name ?? ''}<br>${client?.rut ?? ''}<br>${client?.siteAddress ?? ''}</div>
          <div class="box"><strong>Activo</strong><br>${asset?.tag ?? ''} - ${asset?.name ?? ''}<br>${asset?.location ?? ''}<br>Criticidad: ${asset?.criticality ?? ''}</div>
          <div class="box"><strong>Técnico responsable</strong><br>${technician?.name ?? 'No asignado'}<br>${technician?.specialties?.join(' · ') ?? ''}</div>
          <div class="box"><strong>Contratista</strong><br>${contractor?.companyName ?? 'No asignado'}<br>${contractor?.rut ?? ''}<br>${contractor?.contactName ?? ''}</div>
          <div class="box"><strong>Código OT</strong><br>${order.id}<br>Estado: ${order.status}</div>
          <div class="box"><strong>Incidencia</strong><br>${incident?.title ?? 'Sin incidencia vinculada'}<br>${incident?.voiceTranscript ?? ''}</div>
        </section>
        <h2>Observaciones</h2><p>${observations}</p>
        <h2>Recomendaciones</h2><p>${recommendations}</p>
        <div class="box"><strong>Diagnóstico visual IA</strong><br>${formatDiagnosis(order.visualDiagnosis)}</div>
        <div class="box"><strong>GPS</strong>${(order.gpsTrail ?? []).map((point) => `<small>${point.latitude}, ${point.longitude} · precisión ${Math.round(point.accuracy ?? 0)}m · ${point.capturedAt}</small>`).join('') || '<small>Sin GPS registrado</small>'}</div>
        <h2>Fotos antes</h2><div class="photo-grid">${renderPhotos(beforePhotos, 'Foto antes / diagnóstico')}</div>
        <h2>Fotos después</h2><div class="photo-grid">${renderPhotos(afterPhotos, 'Foto después')}</div>
        <h2>Firma digital</h2><div class="box signature">${signature?.dataUrl?.startsWith('data:text') ? decodeTextDataUrl(signature.dataUrl) : signature ? 'Firma registrada como evidencia adjunta.' : 'Sin firma registrada.'}</div>
        <h2>Historial</h2><div class="box">${(order.history ?? []).map((event) => `<small>${event.at} · ${event.actorId} · ${event.message}</small>`).join('')}</div>
        <div class="footer">${footer}<br>Este informe fue generado digitalmente mediante GLOBALAPP+IA. Contribuyendo a la reducción del uso de papel y a la sostenibilidad ambiental.</div>
        <script>window.print()</script>
      </body>
    </html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (win) { win.document.write(html); win.document.close(); }
}

function renderPhotos(photos, caption) {
  return photos.length ? photos.map((evidence) => `<figure><img class="photo" src="${evidence.dataUrl}" alt="${caption}" /><figcaption>${caption} · ${new Date(evidence.capturedAt).toLocaleString()}</figcaption></figure>`).join('') : '<small>Sin fotografías registradas.</small>';
}

function formatDiagnosis(diagnosis) {
  if (!diagnosis) return 'Sin diagnóstico visual IA registrado.';
  return [
    `Diagnóstico probable: ${diagnosis.likelyCause}`,
    `Nivel de criticidad: ${diagnosis.criticalityLevel ?? diagnosis.riskLevel}`,
    `Riesgo operacional: ${diagnosis.operationalRisk}`,
    `Materiales sugeridos: ${(diagnosis.suggestedMaterials ?? []).join(', ')}`,
    `Recomendación técnica: ${diagnosis.technicalRecommendation}`,
    `Nivel de confianza: ${Math.round((diagnosis.confidence ?? 0) * 100)}%`
  ].join('<br>');
}

function decodeTextDataUrl(dataUrl) {
  try { return decodeURIComponent(escape(atob(dataUrl.split(',')[1] ?? ''))); } catch { return 'Firma registrada.'; }
}
