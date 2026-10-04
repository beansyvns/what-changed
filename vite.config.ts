import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';

// Serves the Vercel-style functions in /api during `npm run dev`,
// so the same server code (and the server-only API key) is used locally.
function apiFunctions(): Plugin {
  const handle = (load: (path: string) => Promise<Record<string, unknown>>) => async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    if (!/^[a-z]+$/.test(name)) return next();
    try {
      const mod = await load(`/api/${name}.ts`);
      const fn = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined;
      if (typeof fn !== 'function') {
        res.statusCode = 405;
        return res.end();
      }
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const request = new Request(url, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      });
      const response = await fn(request);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      if ((e as Error).message?.includes('Failed to load')) return next();
      console.error(e);
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: 'Server error' }));
    }
  };
  let server: ViteDevServer | null = null;
  return {
    name: 'api-functions',
    configureServer(s) {
      server = s;
      s.middlewares.use('/api', (req, res, next) => {
        req.url = `/api${req.url}`;
        return handle((p) => server!.ssrLoadModule(p))(req, res, next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env into process.env for the server functions (not exposed to the browser).
  const env = loadEnv(mode, process.cwd(), '');
  // Skipped under Vitest so tests never use a real key.
  if (!process.env.VITEST)
    for (const k of ['ANTHROPIC_API_KEY', 'AI_PROVIDER', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_MODE', 'AI_SAVER']) if (env[k] !== undefined && process.env[k] === undefined) process.env[k] = env[k];
  return {
    plugins: [react(), apiFunctions()],
    server: { port: 5173 },
  };
});
