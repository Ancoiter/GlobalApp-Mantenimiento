export function createAiProviderFromEnv(env = process.env) {
  const provider = env.AI_PROVIDER ?? 'mock';
  const model = env.AI_MODEL ?? defaultModel(provider);
  const baseUrl = env.AI_BASE_URL ?? defaultBaseUrl(provider);
  const apiKey = env.AI_API_KEY;

  if (provider === 'mock') return createMockAiProvider();
  return createOpenAiCompatibleProvider({ provider, model, baseUrl, apiKey });
}

function defaultModel(provider) {
  if (provider === 'ollama') return 'llava:latest';
  if (provider === 'lmstudio') return 'local-model';
  return 'gpt-4.1-mini';
}

function defaultBaseUrl(provider) {
  if (provider === 'ollama') return 'http://localhost:11434/v1';
  if (provider === 'lmstudio') return 'http://localhost:1234/v1';
  return 'https://api.openai.com/v1';
}

export function createMockAiProvider() {
  return {
    async generateMaintenanceReport({ workOrder, client, asset, contractor }) {
      return [
        `Informe técnico Factory Chile® para ${client.name}`,
        `Activo: ${asset.tag} - ${asset.name}`,
        `Orden: ${workOrder.title}`,
        `Contratista: ${contractor?.companyName ?? 'No asignado'}`,
        `GPS registrado: ${workOrder.gpsTrail?.length ?? 0} punto(s).`,
        `Diagnóstico: ${workOrder.diagnosis ?? 'Pendiente.'}`,
        `Resolución: ${workOrder.resolution ?? 'Sin cierre.'}`,
        `Evidencias: ${workOrder.evidences.length} archivo(s).`,
        'Recomendación IA simulada: validar seguridad, repuestos críticos y tendencia histórica de falla.'
      ].join('\n');
    },
    async chat({ question, context }) {
      return [
        `Asistente IA Factory Chile® (mock): ${question}`,
        'Observación técnica: verificar condición del activo, seguridad y trazabilidad antes de ejecutar.',
        'Recomendación: generar OT, capturar evidencia, validar repuestos y documentar cierre.',
        `Contexto disponible: ${Object.keys(context ?? {}).join(', ') || 'sin contexto'}`
      ].join('\n');
    },
    async diagnoseFailureFromPhoto({ asset, symptoms }) {
      return {
        likelyCause: `Diagnóstico simulado: posible desgaste, desalineación o contaminación en ${asset.name}. Síntomas: ${symptoms}.`,
        criticalityLevel: asset.criticality,
        riskLevel: asset.criticality,
        operationalRisk: 'Posible detención no planificada, daño secundario del activo y exposición operacional si continúa funcionando sin inspección.',
        suggestedMaterials: ['EPP completo', 'Cámara termográfica o termómetro IR', 'Analizador de vibraciones', 'Kit de limpieza industrial', 'Repuesto crítico compatible'],
        technicalRecommendation: 'Aplicar bloqueo y etiquetado, inspeccionar condición visual, medir vibración/temperatura, comparar fotos antes/después y validar intervención con supervisor.',
        recommendedActions: ['Bloqueo y etiquetado.', 'Medir vibración y temperatura.', 'Comparar evidencia antes/después.', 'Solicitar aprobación de supervisor.'],
        confidence: 0.62
      };
    }
  };
}

function createOpenAiCompatibleProvider({ provider, model, baseUrl, apiKey }) {
  async function complete(prompt, photoDataUrl) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Eres experto en mantenimiento industrial, seguridad operacional e informes técnicos Factory Chile®.' },
          { role: 'user', content: photoDataUrl ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: photoDataUrl } }] : prompt }
        ],
        temperature: 0.2
      })
    });
    if (!response.ok) throw new Error(`${provider} error ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    return payload.choices?.[0]?.message?.content ?? 'Sin respuesta IA.';
  }

  return {
    async generateMaintenanceReport(payload) {
      return complete(`Genera un informe técnico Factory Chile® en español para esta orden de mantenimiento:\n${JSON.stringify(payload, null, 2)}`);
    },
    async chat({ question, context }) {
      return complete(`Responde como asistente interno de mantenimiento industrial Factory Chile®. Ayuda con observaciones, recomendaciones, informes, diagnósticos y consultas operacionales.\nPregunta: ${question}\nContexto: ${JSON.stringify(context)}`);
    },
    async diagnoseFailureFromPhoto({ asset, symptoms, photoDataUrl }) {
      const text = await complete(`Diagnostica esta falla industrial desde la imagen. Responde SOLO JSON con: likelyCause, criticalityLevel, riskLevel, operationalRisk, suggestedMaterials, technicalRecommendation, recommendedActions y confidence.\n${JSON.stringify({ asset, symptoms })}`, photoDataUrl);
      try { return JSON.parse(text); } catch { return { likelyCause: text, criticalityLevel: asset.criticality, riskLevel: asset.criticality, operationalRisk: 'Requiere evaluación operacional antes de continuar.', suggestedMaterials: ['EPP completo', 'Instrumentos de medición', 'Repuesto según activo'], technicalRecommendation: 'Validar con supervisor antes de intervenir.', recommendedActions: ['Validar con supervisor antes de intervenir.'], confidence: 0.5 }; }
    }
  };
}
