# GLOBALAPP+IA

Plataforma ejecutable de mantenimiento industrial para **GlobalTech Servicios Industriales SpA**.

## Funciones implementadas

- Identidad visual corporativa GlobalTech, header SaaS moderno, logo industrial y eslogan “Mantenimiento industrial en tus manos”.
- Dashboard ejecutivo con incidencias abiertas/cerradas, OTs pendientes/terminadas, KPIs por técnico, contratista, cliente y empresa, tendencias mensuales, gráficos y ranking de desempeño.
- Crear, guardar y listar incidencias desde la PWA.
- Historial unificado de incidencias, órdenes de trabajo, GPS, dictado, fotos, sincronización e IA.
- Módulo Ayuda con manual paso a paso para incidencias, OTs, técnicos, contratistas, GPS, IA, diagnóstico visual, PDF, offline e instalación PWA.
- Técnicos y contratistas visibles en la operación de terreno.
- Captura GPS mediante `navigator.geolocation`.
- Dictado por voz mediante Web Speech API cuando el navegador lo soporta.
- Fotos antes/después usando cámara o selector de archivos móvil.
- Diagnóstico visual IA funcional con foto desde cámara/galería, criticidad, riesgo operacional, materiales sugeridos, recomendación técnica, confianza e informe automático.
- Exportación de PDF técnico GlobalTech desde el navegador con logo, fotos, firma, cliente, técnico, OT, observaciones, recomendaciones y pie legal dinámico.
- Exportación Excel real compatible con incidencias, órdenes de trabajo, técnicos, contratistas, clientes, KPI y dashboard ejecutivo.
- Biblioteca documental con manuales PDF, planos, procedimientos, fotografías técnicas, fichas técnicas, historial y búsqueda rápida.
- Chat IA interno para observaciones, recomendaciones, informes, diagnósticos y consultas operacionales.
- Sistema ATS con riesgos, EPP requerido, permisos de trabajo, checklist, firma de conformidad e historial.
- Soporte multiempresa mediante configuración editable de logo, colores, nombre comercial, eslogan, plantilla PDF, WhatsApp e identidad visual.
- Dashboard ESG con hojas ahorradas, árboles protegidos, CO2 evitado, fotografías digitales, firmas digitales e informes digitales.
- Botón “Instalar App” para PWA y soporte técnico por WhatsApp al número `56929467522`.
- Reporte de falla con ticket básico, fecha, pantalla, descripción y estado abierto enviado por WhatsApp.
- Modo offline con Service Worker, cache de shell PWA e IndexedDB para cola de incidencias y órdenes.
- Módulo IA mock/simulado para demos sin credenciales.
- Preparación para proveedores OpenAI-compatible: OpenAI, LM Studio y Ollama.

## Arquitectura

```txt
apps/web        PWA web nativa GlobalTech con GPS, voz, fotos, PDF, Service Worker e IndexedDB
apps/api        API Node.js nativa con HTTP, endpoints de incidencias, sincronización e IA
packages/shared Contratos, modelos de dominio y cálculo de KPIs
packages/ai     Adaptadores IA multi-proveedor para OpenAI, LM Studio y Ollama
```

## Requisitos

- Node.js 20 o superior.
- Navegador moderno. Para GPS/cámara/dictado, use Chrome/Edge/Safari móvil o desktop con permisos habilitados.

## Ejecutar localmente

En una terminal:

```bash
npm install
npm run dev:api
```

En otra terminal:

```bash
npm run dev
```

Abra la PWA en:

```txt
http://localhost:5173
```

La API queda disponible en:

```txt
http://localhost:8787/health
```

## Probar modo offline

1. Abra `http://localhost:5173` con la API encendida para cargar datos iniciales.
2. En DevTools active modo offline o detenga `npm run dev:api`.
3. Cree una incidencia o modifique una orden: se guardará en IndexedDB.
4. Vuelva a estar online o reinicie la API: la app sincroniza automáticamente cada 30 segundos o al evento `online`.

## Configurar IA

Copie `.env.example` a `.env` o exporte variables antes de iniciar la API.

### Mock local, recomendado para demo

```bash
AI_PROVIDER=mock npm run dev:api
```

### Ollama

```bash
AI_PROVIDER=ollama AI_MODEL=llava:latest AI_BASE_URL=http://localhost:11434/v1 npm run dev:api
```

### LM Studio

```bash
AI_PROVIDER=lmstudio AI_MODEL=local-model AI_BASE_URL=http://localhost:1234/v1 npm run dev:api
```

### OpenAI

```bash
AI_PROVIDER=openai AI_MODEL=gpt-4.1-mini AI_API_KEY=su_api_key npm run dev:api
```

## Comandos de validación

```bash
npm run typecheck
npm test
npm run build
```
