<script lang="ts">
  import { page } from '$app/state';
  import PostAction from '$lib/components/PostAction.svelte';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let allExpanded = $state(false);
  let groupByStreaming = $state(false);
  let expandedSeries = $state(new Set<string>());
  let expandedOverrides = $state(new Set<string>());
  let detailsRenderKey = $state(0);

  const seriesById = $derived(
    new Map(data.missing.map((series) => [series.seriesId, series]))
  );

  function overrideHref(
    seriesId: string,
    seasonNumber: number,
    episodeNumber: number,
    action: 'present' | 'reset'
  ) {
    return `/episode-check/override/${encodeURIComponent(seriesId)}/${seasonNumber}/${episodeNumber}/${action}?returnTo=/episode-check`;
  }

  function loadSet(key: string) {
    try {
      return new Set(
        JSON.parse(sessionStorage.getItem(key) ?? '[]')
      ) as Set<string>;
    } catch {
      return new Set<string>();
    }
  }

  function saveSet(key: string, values: Set<string>) {
    sessionStorage.setItem(key, JSON.stringify([...values]));
  }

  function collapseAllFromMenu() {
    allExpanded = false;
    expandedSeries = new Set();
    detailsRenderKey += 1;
    sessionStorage.removeItem('lutrafin.episodeCheck.expandedSeries');
  }

  function toggleSeries(seriesId: string, open: boolean) {
    const next = new Set(expandedSeries);
    if (open) next.add(seriesId);
    else next.delete(seriesId);
    expandedSeries = next;
    saveSet('lutrafin.episodeCheck.expandedSeries', next);
  }

  function toggleOverrides(seriesId: string, open: boolean) {
    const next = new Set(expandedOverrides);
    if (open) next.add(seriesId);
    else next.delete(seriesId);
    expandedOverrides = next;
    saveSet('lutrafin.episodeCheck.expandedOverrides', next);
  }

  function toggleAllSeries() {
    if (allExpanded) {
      allExpanded = false;
      expandedSeries = new Set();
      detailsRenderKey += 1;
      saveSet('lutrafin.episodeCheck.expandedSeries', expandedSeries);
      return;
    }

    allExpanded = true;
    expandedSeries = new Set(data.missing.map((series) => series.seriesId));
    detailsRenderKey += 1;
    saveSet('lutrafin.episodeCheck.expandedSeries', expandedSeries);
  }

  onMount(() => {
    if (page.url.searchParams.get('collapsed') === '1') {
      collapseAllFromMenu();
      return;
    }
    expandedSeries = loadSet('lutrafin.episodeCheck.expandedSeries');
    expandedOverrides = loadSet('lutrafin.episodeCheck.expandedOverrides');
  });

  $effect(() => {
    if (page.url.searchParams.get('collapsed') === '1') {
      collapseAllFromMenu();
    }
  });
</script>

<svelte:head>
  <title>{data.t.findMissingEpisodes} - Lutrafin</title>
</svelte:head>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page">
    <p class="eyebrow">{data.t.episodeCheck}</p>
    <h1>{data.t.findMissingEpisodes}</h1>
    <p class="muted">{data.t.episodeCheckHelp}</p>

    {#if data.missing.length === 0}
      <p class="muted">{data.t.noMissingEpisodes}</p>
    {:else}
      <div class="actions episode-check-actions">
        {#if data.streamingGroupingAvailable}
          <button
            class="button secondary"
            type="button"
            data-state={groupByStreaming ? 'on' : 'off'}
            onclick={() => (groupByStreaming = !groupByStreaming)}
          >
            {groupByStreaming
              ? data.t.showNormalEpisodeList
              : data.t.groupByStreamingProvider}
          </button>
        {/if}
        <button
          class="button secondary"
          type="button"
          onclick={toggleAllSeries}
        >
          {allExpanded ? data.t.collapseAll : data.t.expandAll}
        </button>
      </div>

      {#snippet seriesCard(series: PageData['missing'][number])}
        <details
          class="episode-series-card"
          open={allExpanded || expandedSeries.has(series.seriesId)}
          ontoggle={(event) =>
            toggleSeries(series.seriesId, event.currentTarget.open)}
        >
          <summary>
            <div class="poster episode-series-poster" aria-hidden="true">
              {#if series.posterUrl}<img
                  src={series.posterUrl}
                  alt=""
                />{:else}<span>{series.seriesName.slice(0, 1)}</span>{/if}
            </div>
            <div class="episode-series-summary">
              <strong>{series.seriesName}</strong>
              <span>
                {#if series.productionYear}{series.productionYear} ·
                {/if}{series.missingCount}
                {data.t.missingEpisodes} · {series.seasons.length}
                {data.t.affectedSeasons}
              </span>
            </div>
          </summary>
          <div class="actions episode-card-actions">
            <a
              class="button secondary settings-action compact"
              href={`/series/${series.seriesId}?returnTo=/episode-check`}
              >{data.t.details}</a
            >
            {#if data.admin}
              <PostAction
                class="button secondary settings-action compact"
                href={`/settings/series/${series.seriesId}/ignore?returnTo=/episode-check`}
                >{data.t.ignore}</PostAction
              >
            {/if}
          </div>
          <div class="episode-season-list">
            {#each series.seasons as season}
              <section class="episode-season-group">
                <h2>
                  {data.t.season} S{String(season.seasonNumber).padStart(
                    2,
                    '0'
                  )}
                </h2>
                <div class="episode-missing-list">
                  {#each season.episodes as episode}
                    <span class="episode-missing-row">
                      <span>
                        E{String(episode.episodeNumber).padStart(2, '0')}
                        {#if episode.episodeName}· {episode.episodeName}{/if}
                        · {episode.airDate}
                      </span>
                      {#if data.admin}
                        <PostAction
                          class="button secondary settings-action compact"
                          href={overrideHref(
                            series.seriesId,
                            season.seasonNumber,
                            episode.episodeNumber,
                            'present'
                          )}
                          preserveScroll>{data.t.markAsPresent}</PostAction
                        >
                      {/if}
                    </span>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
          <details
            class="manual-overrides"
            open={expandedOverrides.has(series.seriesId)}
            ontoggle={(event) =>
              toggleOverrides(series.seriesId, event.currentTarget.open)}
          >
            <summary>{data.t.manualOverrides}</summary>
            {#if series.overrides.length === 0}
              <p class="muted">{data.t.noManualOverrides}</p>
            {:else}
              <div class="episode-missing-list">
                {#each series.overrides as override}
                  <span class="episode-missing-row">
                    <span>
                      S{String(override.seasonNumber).padStart(2, '0')} E{String(
                        override.episodeNumber
                      ).padStart(2, '0')}
                      {#if override.episodeName}
                        - {override.episodeName}{/if}
                    </span>
                    {#if data.admin}
                      <PostAction
                        class="button secondary settings-action compact"
                        href={overrideHref(
                          series.seriesId,
                          override.seasonNumber,
                          override.episodeNumber,
                          'reset'
                        )}
                        preserveScroll>{data.t.resetOverride}</PostAction
                      >
                    {/if}
                  </span>
                {/each}
              </div>
            {/if}
          </details>
        </details>
      {/snippet}

      {#key detailsRenderKey}
        <div class="episode-check-list">
          {#if groupByStreaming && data.streamingGroups.length > 0}
            {#each data.streamingGroups as group}
              <section class="streaming-group">
                <h2>{group.label}</h2>
                {#each group.seriesIds as seriesId}
                  {@const series = seriesById.get(seriesId)}
                  {#if series}{@render seriesCard(series)}{/if}
                {/each}
              </section>
            {/each}
          {:else}
            {#each data.missing as series (series.seriesId)}
              {@render seriesCard(series)}
            {/each}
          {/if}
        </div>
      {/key}
    {/if}
  </section>
</main>
