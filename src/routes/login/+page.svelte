<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let error = $state<string | null>(null);
  let pending = $state(false);

  async function login(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    error = null;
    pending = true;

    try {
      const response = await fetch('/login/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: String(formData.get('username') ?? ''),
          password: String(formData.get('password') ?? '')
        })
      });

      if (!response.ok) {
        const result = await response
          .json()
          .catch(() => ({ error: data.t.invalidLogin }));
        error = result.error ?? data.t.invalidLogin;
        return;
      }

      await goto('/settings');
    } finally {
      pending = false;
    }
  }
</script>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page">
    <h1>{data.t.adminLogin}</h1>
    <p class="muted">{data.t.loginHelp}</p>
    <form class="settings-form login-form" onsubmit={login}>
      <label>
        {data.t.username}
        <input name="username" autocomplete="username" required />
      </label>
      <label>
        {data.t.password}
        <input
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>
      {#if error}<p class="error-text">{error}</p>{/if}
      <div class="actions">
        <button class="button" type="submit" disabled={pending}
          >{data.t.login}</button
        >
      </div>
    </form>
  </section>
</main>
