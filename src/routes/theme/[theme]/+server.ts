import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeRedirectPath } from '$lib/server/http/redirects';

const themes = new Set(['system', 'light', 'dark']);

export const POST: RequestHandler = ({ cookies, params, request, url }) => {
  const theme = themes.has(params.theme) ? params.theme : 'system';

  if (theme === 'system') {
    cookies.delete('lutrafin-theme', { path: '/' });
  } else {
    cookies.set('lutrafin-theme', theme, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });
  }

  const explicitReturnTo = safeRedirectPath(
    url.searchParams.get('returnTo'),
    ''
  );
  if (explicitReturnTo) throw redirect(303, explicitReturnTo);

  const referer = request.headers.get('referer');
  const redirectTo = referer
    ? new URL(referer, url.origin).pathname +
      new URL(referer, url.origin).search
    : '/';
  throw redirect(303, redirectTo);
};
