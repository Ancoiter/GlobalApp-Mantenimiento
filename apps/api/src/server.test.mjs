import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from './server.mjs';

async function withServer(run) {
  const server = createServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('health endpoint responds with service metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, 'GLOBALAPP+IA API');
  });
});

test('can create and list an incident through bootstrap', async () => {
  await withServer(async (baseUrl) => {
    const incident = {
      id: `inc-test-${Date.now()}`,
      clientId: 'cli-001',
      assetId: 'act-001',
      title: 'Incidencia test',
      description: 'Creada desde prueba automatizada',
      priority: 'high',
      reportedAt: new Date().toISOString(),
      status: 'open',
      history: []
    };
    const createResponse = await fetch(`${baseUrl}/api/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(incident) });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.title, incident.title);
    assert.equal(created.history.at(-1).type, 'created');

    const bootstrap = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
    assert.ok(bootstrap.incidents.some((item) => item.id === incident.id));
    assert.ok(Array.isArray(bootstrap.contractors));
  });
});


test('mock visual diagnosis returns operational fields', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: 'act-001', photoDataUrl: 'data:image/png;base64,AA==', symptoms: 'Ruido y fuga visible' })
    });
    assert.equal(response.status, 200);
    const diagnosis = await response.json();
    assert.equal(diagnosis.criticalityLevel, 'critical');
    assert.ok(diagnosis.operationalRisk);
    assert.ok(Array.isArray(diagnosis.suggestedMaterials));
    assert.ok(diagnosis.technicalRecommendation);
    assert.equal(typeof diagnosis.confidence, 'number');
  });
});


test('internal AI chat returns an assistant answer', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Genera recomendación de seguridad', context: { module: 'ATS' } })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(payload.answer.includes('GlobalTech'));
  });
});
