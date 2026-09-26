export type FetchJsonOptions = {
  headers?: HeadersInit;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
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

export async function fetchJson(
  url: URL,
  options: FetchJsonOptions = {}
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 250;

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

      return await response.json();
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
