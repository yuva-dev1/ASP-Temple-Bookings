import express from 'express';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 8080);
const scriptUrl = process.env.APPS_SCRIPT_URL;
const sharedToken = process.env.APPS_SCRIPT_TOKEN;

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

async function callSheet(action: string, data: Record<string, unknown> = {}) {
  if (!scriptUrl || !sharedToken) {
    throw new Error('Booking service is not configured yet. Please check back soon.');
  }
  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, token: sharedToken, action }),
    redirect: 'follow',
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || 'We could not complete that request. Please try again.') as Error & { status?: number };
    error.status = response.status || 400;
    throw error;
  }
  return result;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/availability', async (_req, res) => {
  try { res.json(await callSheet('availability')); }
  catch (error) { res.status(503).json({ ok: false, error: error instanceof Error ? error.message : 'Availability is temporarily unavailable.' }); }
});

for (const action of ['book', 'lookup', 'update', 'cancel']) {
  app.post(`/api/${action}`, async (req, res) => {
    try { res.json(await callSheet(action, req.body || {})); }
    catch (error) {
      const status = (error as Error & { status?: number }).status || 400;
      res.status(status).json({ ok: false, error: error instanceof Error ? error.message : 'Request failed.' });
    }
  });
}

const clientPath = path.resolve(process.cwd(), 'dist/client');
app.use(express.static(clientPath, { maxAge: '1h' }));
app.get('*path', (_req, res) => res.sendFile(path.join(clientPath, 'index.html')));

app.listen(port, '0.0.0.0', () => console.log(`Nama Bhiksha booking app listening on ${port}`));
