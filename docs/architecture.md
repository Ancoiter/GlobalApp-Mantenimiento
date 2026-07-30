# Arquitectura FACTORY CHILE®

## Principios

1. **Offline-first:** el trabajo de terreno no depende de cobertura móvil. La PWA guarda órdenes, fotos, firmas, GPS, dictados y eventos en IndexedDB y sincroniza cuando vuelve la conexión.
2. **Dominio compartido:** modelos y contratos viven en `packages/shared` para evitar divergencia entre frontend y backend.
3. **IA intercambiable:** `packages/ai` y `apps/api/src/ai-provider.mjs` exponen diagnóstico visual e informes con modo mock y adaptadores para OpenAI, LM Studio y Ollama.
4. **Evidencia auditable:** cada incidencia y orden mantiene fotos antes/después, firma digital, GPS, historial técnico, timestamps y responsable.
5. **Marca Factory Chile®:** header corporativo, logo industrial, soporte WhatsApp, reporte de fallas con ticket y experiencia SaaS empresarial sin copiar marcas externas.

## Capas

- **Presentación:** `apps/web`, PWA web nativa con dashboard ejecutivo, exportación Excel, biblioteca documental, chat IA interno, ATS, ESG, configuración multiempresa, ayuda/manual, GPS, dictado por voz, diagnóstico visual IA, Service Worker, IndexedDB, fotos antes/después, historial y PDF técnico corporativo.
- **API:** `apps/api`, servidor HTTP nativo de Node.js, creación de incidencias, módulos de mantenimiento e IA, contratistas, sincronización e historial, almacenamiento semilla en memoria reemplazable por PostgreSQL.
- **Dominio:** `packages/shared`, entidades, contratistas, geolocalización, historial, estados, DTOs y cálculo de KPIs.
- **IA:** `packages/ai`, casos de uso `generateMaintenanceReport` y `diagnoseFailureFromPhoto`.

## Roadmap técnico

1. Sustituir almacenamiento en memoria por PostgreSQL + Prisma.
2. Agregar autenticación RBAC para administrador, supervisor, técnico y cliente.
3. Activar Background Sync cuando el soporte del navegador esté disponible.
4. Migrar fotos a S3-compatible storage con URLs firmadas.
5. Incorporar trazabilidad de prompts, consentimiento y revisión humana para diagnósticos IA.
