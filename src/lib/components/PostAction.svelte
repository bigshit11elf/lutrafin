<script lang="ts">
  import { goto } from '$app/navigation';

  let {
    href,
    class: className = '',
    disabled = false,
    confirmMessage,
    preserveScroll = false,
    children,
    ...rest
  }: {
    href: string;
    class?: string;
    disabled?: boolean;
    confirmMessage?: string;
    preserveScroll?: boolean;
    children: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();

  let pending = $state(false);

  function applyThemePreference() {
    const theme = rest['data-theme-option'];
    if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return;

    document.documentElement.dataset.themePreference = theme;
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
      return;
    }
    document.documentElement.dataset.theme = theme;
  }

  async function run() {
    if (disabled || pending) return;
    if (confirmMessage && !confirm(confirmMessage)) return;
    pending = true;
    try {
      const response = await fetch(href, {
        method: 'POST',
        headers: { accept: 'application/json' },
        redirect: 'follow'
      });
      if (response.ok || response.redirected) applyThemePreference();
      if (response.redirected) {
        const url = new URL(response.url);
        await goto(url.pathname + url.search + url.hash, {
          invalidateAll: true,
          noScroll: preserveScroll
        });
        return;
      }
      if (response.ok) {
        await goto(location.pathname + location.search + location.hash, {
          invalidateAll: true,
          noScroll: preserveScroll
        });
      }
    } finally {
      pending = false;
    }
  }
</script>

<button
  {...rest}
  class={className}
  type="button"
  disabled={disabled || pending}
  onclick={run}
>
  {@render children()}
</button>
