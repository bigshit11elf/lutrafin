import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
  new Response(
    readFileSync(join(process.cwd(), 'THIRD_PARTY_NOTICES.md'), 'utf8'),
    { headers: { 'content-type': 'text/markdown; charset=utf-8' } }
  );
