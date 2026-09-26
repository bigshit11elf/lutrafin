import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../src/lib/server/http/concurrency';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mapWithConcurrency', () => {
  it('keeps the input order in the result', async () => {
    const result = await mapWithConcurrency(
      [5, 1, 4, 2, 3],
      2,
      async (item) => {
        await tick();
        return item * 10;
      }
    );

    expect(result).toEqual([50, 10, 40, 20, 30]);
  });

  it('never runs more workers than the limit', async () => {
    let running = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 40 }, (_, index) => index),
      4,
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await tick();
        running -= 1;
      }
    );

    expect(peak).toBe(4);
  });

  it('processes every item exactly once', async () => {
    const seen: number[] = [];

    await mapWithConcurrency(
      Array.from({ length: 100 }, (_, index) => index),
      7,
      async (item) => {
        seen.push(item);
      }
    );

    expect(seen.sort((left, right) => left - right)).toEqual(
      Array.from({ length: 100 }, (_, index) => index)
    );
  });

  it('handles empty input and a limit below one', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    expect(
      await mapWithConcurrency([1, 2], 0, async (item) => item + 1)
    ).toEqual([2, 3]);
  });

  it('rejects when a worker fails', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('boom');
        return item;
      })
    ).rejects.toThrow('boom');
  });
});
