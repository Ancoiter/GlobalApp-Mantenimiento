import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = normalize(join(process.cwd(), 'apps/web'));
const port = Number(process.env.WEB_PORT ?? 5173);
const apiTarget = new URL(process.env.API_TARGET ?? 'http://localhost:8787');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname.startsWith('/api') || url.pathname === '/health') return proxyApi(request, response, url);

  let file = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(root) || !existsSync(file)) file = join(root, 'index.html');
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`FACTORY CHILE® PWA escuchando en http://localhost:${port}`));

function proxyApi(clientRequest, clientResponse, url) {
  const proxyRequest = http.request({
    hostname: apiTarget.hostname,
    port: apiTarget.port,
    path: `${url.pathname}${url.search}`,
    method: clientRequest.method,
    headers: clientRequest.headers
  }, (proxyResponse) => {
    clientResponse.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
    proxyResponse.pipe(clientResponse);
  });
  proxyRequest.on('error', () => {
    clientResponse.writeHead(503, { 'Content-Type': 'application/json' });
    clientResponse.end(JSON.stringify({ message: 'API no disponible. Inicie npm run dev:api.' }));
  });
  clientRequest.pipe(proxyRequest);
}
