import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist/web', { recursive: true, force: true });
await mkdir('dist/web', { recursive: true });
await cp('apps/web', 'dist/web', { recursive: true });
console.log('PWA copiada a dist/web');
