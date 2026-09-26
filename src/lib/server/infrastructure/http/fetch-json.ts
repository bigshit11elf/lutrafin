export type FetchJsonOptions = {
  headers?: HeadersInit;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  maxBytes?: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function retryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const retryDate = Date.parse(retryAfter);
  return Number.isFinite(retryDate)
    ? Math.max(0, retryDate - Date.now())
    : undefined;
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly url: string
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpStatusError';
  }
}

export class ResponseTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`HTTP response exceeded ${maxBytes} bytes`);
    this.name = 'ResponseTooLargeError';
  }
}

async function readLimitedJson(
  response: Response,
  maxBytes: number
): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) throw new ResponseTooLargeError(maxBytes);

  const reader = response.body?.getReader();
  if (!reader) return response.json();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const body = new TextDecoder().decode(Buffer.concat(chunks));
  return JSON.parse(body);
}

export async function fetchJson(
  url: URL,
  options: FetchJsonOptions = {}
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 250;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: options.headers,
        redirect: 'error',
        signal: controller.signal
      });

      if (!response.ok) {
        if (attempt < retries && isTransientStatus(response.status)) {
          await delay(retryAfterMs(response) ?? retryDelayMs * 2 ** attempt);
          continue;
        }

        throw new HttpStatusError(response.status, url.origin + url.pathname);
      }

      return await readLimitedJson(response, maxBytes);
    } catch (error) {
      if (attempt < retries && !(error instanceof HttpStatusError)) {
        await delay(retryDelayMs * 2 ** attempt);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Unreachable fetch retry state');
}
