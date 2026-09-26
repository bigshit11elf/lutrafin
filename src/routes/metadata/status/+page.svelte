<script lang="ts">
  import DateTime from '$lib/components/DateTime.svelte';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const matchMethodLabel = (method: string) => {
    if (method === 'exact_external_id') return data.t.matchExactExternalId;
    if (method === 'cross_provider_id') return data.t.matchCrossProviderId;
    if (method === 'exact_name_year') return data.t.matchExactNameYear;
    if (method === 'manual') return data.t.matchManual;
    return data.t.matchUnresolved;
  };

  const providerUrl = (
    provider: string,
    providerSeriesId: string | null
  ): string | null => {
    if (!providerSeriesId) return null;
    if (provider === 'tmdb') {
      return `https://www.themoviedb.org/tv/${encodeURIComponent(providerSeriesId)}`;
    }
    if (provider === 'tvmaze') {
      return `https://www.tvmaze.com/shows/${encodeURIComponent(providerSeriesId)}`;
    }
    return null;
  };
</script>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page">
    <h1>{data.t.metadataStatus}</h1>
    {#if data.admin}
      <div class="status-actions">
        <a class="button clear-action" href="/metadata/status?confirmClear=1"
          >{data.t.clear}</a
        >
      </div>
    {/if}
    {#if data.message}
      <p class="error-text" role="status">{data.message}</p>
    {/if}
    {#if data.lookups.length === 0}
      <p class="muted">{data.t.noMetadataLookups}</p>
    {:else}
      <div class="run-list">
        {#each data.lookups as lookup}
          <article class="run-row">
            <strong>{lookup.seriesName}</strong>
            <span
              >{lookup.provider} · {matchMethodLabel(lookup.matchMethod)}</span
            >
            <span>
              <DateTime
                value={lookup.fetchedAt}
                language={data.language}
                fallback={lookup.fetchedAt}
              />
            </span>
            <span class="badge" class:danger={!lookup.successful}
              >{lookup.successful
                ? data.t.successful
                : (lookup.errorCode ?? data.t.failed)}</span
            >
            {#if lookup.providerSeriesId}
              {@const url = providerUrl(
                lookup.provider,
                lookup.providerSeriesId
              )}
              {#if url}
                <a href={url} target="_blank" rel="noreferrer noopener"
                  >{lookup.providerSeriesId}</a
                >
              {:else}
                <span>{lookup.providerSeriesId}</span>
              {/if}
            {/if}
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
        aria-labelledby="clear-metadata-status-title"
      >
        <p class="eyebrow">{data.t.metadataStatus}</p>
        <h2 id="clear-metadata-status-title">{data.t.clear}</h2>
        <p>{data.t.clearMetadataStatusConfirm}</p>
        <div class="actions dialog-actions">
          <a class="button secondary" href="/metadata/status">{data.t.cancel}</a
          >
          <PostAction class="button clear-action" href="/metadata/status/clear"
            >{data.t.clear}</PostAction
          >
        </div>
      </div>
    </div>
  {/if}
</main>
