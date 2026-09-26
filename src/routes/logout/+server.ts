import { redirect } from '@sveltejs/kit';
import { clearAdminSession } from '$lib/server/auth/admin';

export const POST = ({
  cookies
}: {
  cookies: import('@sveltejs/kit').Cookies;
}) => {
  clearAdminSession(cookies);
  throw redirect(303, '/');
};
