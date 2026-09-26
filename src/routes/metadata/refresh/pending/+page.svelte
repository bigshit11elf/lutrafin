<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const label = $derived(
    data.force ? data.t.refreshAllMetadata : data.t.refreshDueMetadata
  );
  const target = $derived(
    data.force ? '/metadata/refresh/run?force=1' : '/metadata/refresh/run'
  );

  onMount(() => {
    const timer = setTimeout(async () => {
      const response = await fetch(target, {
        method: 'POST',
        redirect: 'follow'
      });
      if (response.redirected)
        await goto(
          new URL(response.url).pathname + new URL(response.url).search
        );
    }, 700);
    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>{label} - Lutrafin</title>
</svelte:head>

<div class="progress-overlay" role="status" aria-live="polite">
  <div class="progress-card">
    <div class="progress-orb" aria-hidden="true"></div>
    <p class="eyebrow">{data.t.progressPreparing}</p>
    <h2>{data.t.metadataActions}: {label}</h2>
    <div class="progress-track" aria-hidden="true">
      <span></span>
    </div>
    <p>{data.t.progressHint}</p>
  </div>
</div>
