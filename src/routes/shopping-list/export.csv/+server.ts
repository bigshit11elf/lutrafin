import type { RequestHandler } from './$types';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

function csvCell(value: string | number | null): string {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export const GET: RequestHandler = () => {
  const rows = new ShoppingListRepository(getDatabase()).list();
  const csv = [
    ['priority', 'series', 'season', 'status', 'source'].map(csvCell).join(','),
    ...rows.map((row) =>
      [
        row.priority,
        row.seriesName,
        row.seasonNumber,
        row.status,
        row.sourceUrl
      ]
        .map(csvCell)
        .join(',')
    )
  ].join('\n');
  return new Response(`${csv}\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="lutrafin-shopping-list.csv"'
    }
  });
};
