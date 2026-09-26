import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
  new Response(readFileSync(join(process.cwd(), 'LICENSE'), 'utf8'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
