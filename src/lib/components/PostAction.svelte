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
