<script lang="ts">
  import DateTime from '$lib/components/DateTime.svelte';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  const syncTypeLabel = (type: string) =>
    type === 'metadata' ? data.t.syncTypeMetadata : data.t.syncTypeJellyfin;

  const syncStatusLabel = (status: string) => {
    if (status === 'success') return data.t.successful;
    if (status === 'failed') return data.t.failed;
    return data.t.running;
  };
</script>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page">
    <h1>{data.t.syncStatus}</h1>
    <div class="status-actions">
      {#if data.admin}
        <a class="button clear-action" href="/sync?confirmClear=1"
          >{data.t.clear}</a
        >
      {/if}
    </div>
    {#if data.message}
      <p class="error-text" role="status">{data.message}</p>
    {/if}
    {#if data.runs.length === 0}
      <p class="muted">{data.t.noSyncRuns}</p>
    {:else}
      <div class="run-list">
        {#each data.runs as run}
          <article class="run-row">
            <strong
              >{syncTypeLabel(run.type)} · {syncStatusLabel(run.status)}</strong
            >
            <span>
              <DateTime
                value={run.startedAt}
                language={data.language}
                fallback={run.startedAt}
              />
            </span>
            <span
              >{run.seriesRead}
              {data.t.seriesCount} · {run.seasonsRead}
              {data.t.seasonsCount} · {run.durationMs ?? 0}ms</span
            >
            {#if run.errorCode}<span class="error-text">{run.errorCode}</span
              >{/if}
          </article>
        {/each}
      </div>
    {/if}
  </section>

  {#if data.admin && data.confirmClear}
    <div class="dialog-overlay" role="presentation">
      <div
        class="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-sync-status-title"
      >
        <p class="eyebrow">{data.t.syncStatus}</p>
        <h2 id="clear-sync-status-title">{data.t.clear}</h2>
        <p>{data.t.clearSyncStatusConfirm}</p>
        <div class="actions dialog-actions">
          <a class="button secondary" href="/sync">{data.t.cancel}</a>
          <PostAction class="button clear-action" href="/sync/clear"
            >{data.t.clear}</PostAction
          >
        </div>
      </div>
    </div>
  {/if}
</main>
