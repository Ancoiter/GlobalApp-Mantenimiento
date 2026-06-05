export type AiProviderName = 'mock' | 'openai' | 'lmstudio' | 'ollama';
export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AiProviderConfig {
  provider: AiProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
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

export interface AiProvider {
  generateMaintenanceReport(request: unknown): Promise<string>;
  diagnoseFailureFromPhoto(request: { asset: { name: string; criticality: IncidentPriority }; photoDataUrl: string; symptoms: string }): Promise<AiDiagnosis>;
}

class MockAiProvider implements AiProvider {
  async generateMaintenanceReport(request: unknown): Promise<string> {
    const payload = request as { workOrder?: { title?: string; diagnosis?: string; resolution?: string; evidences?: unknown[] }; client?: { name?: string }; asset?: { tag?: string; name?: string } };
    return [
      `Informe de mantenimiento para ${payload.client?.name ?? 'cliente'}`,
      `Activo: ${payload.asset?.tag ?? 'S/T'} - ${payload.asset?.name ?? 'activo'}`,
      `Orden: ${payload.workOrder?.title ?? 'orden de trabajo'}`,
      `Diagnóstico: ${payload.workOrder?.diagnosis ?? 'Pendiente de completar por técnico.'}`,
      `Resolución: ${payload.workOrder?.resolution ?? 'Sin cierre registrado.'}`,
      `Evidencias: ${payload.workOrder?.evidences?.length ?? 0} archivo(s) capturado(s).`,
      'Recomendación IA: revisar tendencia de fallas y validar repuestos críticos.'
    ].join('\n');
  }

  async diagnoseFailureFromPhoto(request: { asset: { name: string; criticality: IncidentPriority }; symptoms: string }): Promise<AiDiagnosis> {
    return {
      likelyCause: `Posible desgaste, desalineación o contaminación operacional en ${request.asset.name}. Síntomas reportados: ${request.symptoms}.`,
      criticalityLevel: request.asset.criticality,
      operationalRisk: 'Posible detención no planificada o daño secundario si continúa operando.',
      suggestedMaterials: ['EPP completo', 'Instrumentos de medición', 'Kit de limpieza', 'Repuesto crítico según activo'],
      technicalRecommendation: 'Aislar el equipo, inspeccionar visualmente, medir variables críticas y validar con supervisor.',
      recommendedActions: ['Aplicar bloqueo y etiquetado.', 'Comparar fotografía con condición normal.', 'Medir vibración, temperatura y consumo.', 'Validar con supervisor.'],
      riskLevel: request.asset.criticality,
      confidence: 0.62
    };
  }
}

class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly config: AiProviderConfig) {}

  async generateMaintenanceReport(request: unknown): Promise<string> {
    return this.textCompletion(`Genera un informe técnico corporativo en español para esta orden:\n${JSON.stringify(request, null, 2)}`);
  }

  async diagnoseFailureFromPhoto(request: { asset: { name: string; criticality: IncidentPriority }; photoDataUrl: string; symptoms: string }): Promise<AiDiagnosis> {
    const content = await this.textCompletion(`Diagnostica la falla industrial. Responde JSON con likelyCause, criticalityLevel, operationalRisk, suggestedMaterials, technicalRecommendation, recommendedActions, riskLevel y confidence.\n${JSON.stringify({ asset: request.asset, symptoms: request.symptoms })}`, request.photoDataUrl);
    try { return JSON.parse(content) as AiDiagnosis; } catch { return { likelyCause: content, criticalityLevel: request.asset.criticality, operationalRisk: 'Requiere evaluación operacional.', suggestedMaterials: ['EPP completo', 'Instrumentos de medición'], technicalRecommendation: 'Revisar diagnóstico con supervisor.', recommendedActions: ['Revisar diagnóstico con supervisor.'], riskLevel: request.asset.criticality, confidence: 0.5 }; }
  }

  private async textCompletion(prompt: string, photoDataUrl?: string): Promise<string> {
    const response = await fetch(`${this.resolveBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}) },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'Eres experto en mantenimiento industrial, seguridad operacional y reportes ejecutivos.' },
          { role: 'user', content: photoDataUrl ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: photoDataUrl } }] : prompt }
        ],
        temperature: 0.2
      })
    });
    if (!response.ok) throw new Error(`AI provider error ${response.status}: ${await response.text()}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? 'Sin respuesta del proveedor IA.';
  }

  private resolveBaseUrl(): string {
    if (this.config.provider === 'ollama') return this.config.baseUrl ?? 'http://localhost:11434/v1';
    if (this.config.provider === 'lmstudio') return this.config.baseUrl ?? 'http://localhost:1234/v1';
    return this.config.baseUrl ?? 'https://api.openai.com/v1';
  }
}

export function createAiProvider(config: AiProviderConfig): AiProvider {
  return config.provider === 'mock' ? new MockAiProvider() : new OpenAiCompatibleProvider(config);
}
