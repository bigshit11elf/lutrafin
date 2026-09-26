<script lang="ts">
  import { page } from '$app/state';
  import PostAction from '$lib/components/PostAction.svelte';
  import { onMount, untrack } from 'svelte';
  import type { PageData } from './$types';

  const expandedSeriesKey = 'lutrafin.episodeCheck.expandedSeries';
  const expandedOverridesKey = 'lutrafin.episodeCheck.expandedOverrides';
  const expandAllConfirmThreshold = 25;
  const initialEpisodesPerSeason = 100;

  let { data }: { data: PageData } = $props();
  let allExpanded = $state(false);
  let groupByStreaming = $state(false);
  let expandedSeries = $state(new Set<string>());
  let expandedOverrides = $state(new Set<string>());
  let expandedEpisodeLists = $state(new Set<string>());

  const seriesById = $derived(
    new Map(data.missing.map((series) => [series.seriesId, series]))
  );

  const persistTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  function isSeriesExpanded(seriesId: string): boolean {
    return allExpanded || expandedSeries.has(seriesId);
  }

  function isOverrideExpanded(seriesId: string): boolean {
    return expandedOverrides.has(seriesId);
  }

  function episodeListKey(seriesId: string, seasonNumber: number): string {
    return `${seriesId}:${seasonNumber}`;
  }

  function visibleEpisodes(
    seriesId: string,
    season: PageData['missing'][number]['seasons'][number]
  ) {
    return expandedEpisodeLists.has(
      episodeListKey(seriesId, season.seasonNumber)
    )
      ? season.episodes
      : season.episodes.slice(0, initialEpisodesPerSeason);
  }

  function toggleEpisodeList(seriesId: string, seasonNumber: number) {
    const key = episodeListKey(seriesId, seasonNumber);
    const next = new Set(expandedEpisodeLists);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedEpisodeLists = next;
  }

  function syncOpen(node: HTMLDetailsElement, open: boolean) {
    if (node.open !== open) node.open = open;
    return {
      update(next: boolean) {
        if (node.open !== next) node.open = next;
      }
    };
  }

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

  function saveSet(key: string, values: Set<string>, immediate = false) {
    const write = () =>
      sessionStorage.setItem(key, JSON.stringify([...values]));
    if (persistTimers[key]) clearTimeout(persistTimers[key]);
    if (immediate) {
      delete persistTimers[key];
      write();
      return;
    }
    persistTimers[key] = setTimeout(() => {
      delete persistTimers[key];
      write();
    }, 300);
  }

  function collapseAll() {
    allExpanded = false;
    expandedSeries = new Set();
    saveSet(expandedSeriesKey, expandedSeries, true);
  }

  function collapseAllFromMenu() {
    collapseAll();
    if (persistTimers[expandedSeriesKey]) {
      clearTimeout(persistTimers[expandedSeriesKey]);
      delete persistTimers[expandedSeriesKey];
    }
    sessionStorage.removeItem(expandedSeriesKey);
  }

  function toggleSeries(seriesId: string, open: boolean) {
    if (isSeriesExpanded(seriesId) === open) return;
    const next = new Set(expandedSeries);
    if (open) next.add(seriesId);
    else next.delete(seriesId);
    expandedSeries = next;
    saveSet(expandedSeriesKey, next);
  }

  function toggleOverrides(seriesId: string, open: boolean) {
    if (isOverrideExpanded(seriesId) === open) return;
    const next = new Set(expandedOverrides);
    if (open) next.add(seriesId);
    else next.delete(seriesId);
    expandedOverrides = next;
    saveSet(expandedOverridesKey, next);
  }

  function toggleAllSeries() {
    if (allExpanded) {
      collapseAll();
      return;
    }

    if (
      data.missing.length >= expandAllConfirmThreshold &&
      !confirm(
        `${data.missing.length} ${data.t.series} - ${data.t.expandAllConfirm}`
      )
    ) {
      return;
    }

    allExpanded = true;
    expandedSeries = new Set(data.missing.map((series) => series.seriesId));
    saveSet(expandedSeriesKey, expandedSeries, true);
  }

  onMount(() => {
    if (page.url.searchParams.get('collapsed') === '1') {
      collapseAllFromMenu();
      return;
    }
    expandedSeries = loadSet(expandedSeriesKey);
    expandedOverrides = loadSet(expandedOverridesKey);
  });

  $effect(() => {
    const collapsedRequested = page.url.searchParams.get('collapsed') === '1';
    untrack(() => {
      if (collapsedRequested) collapseAllFromMenu();
    });
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
          use:syncOpen={isSeriesExpanded(series.seriesId)}
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
          {#if isSeriesExpanded(series.seriesId)}
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
                    {#each visibleEpisodes(series.seriesId, season) as episode}
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
                  {#if season.episodes.length > initialEpisodesPerSeason}
                    {@const listExpanded = expandedEpisodeLists.has(
                      episodeListKey(series.seriesId, season.seasonNumber)
                    )}
                    <button
                      class="button secondary settings-action compact"
                      type="button"
                      onclick={() =>
                        toggleEpisodeList(series.seriesId, season.seasonNumber)}
                    >
                      {listExpanded
                        ? data.t.showFewerEpisodes
                        : `${data.t.showAllEpisodes} (${season.episodes.length})`}
                    </button>
                  {/if}
                </section>
              {/each}
            </div>
            <details
              class="manual-overrides"
              use:syncOpen={isOverrideExpanded(series.seriesId)}
              ontoggle={(event) =>
                toggleOverrides(series.seriesId, event.currentTarget.open)}
            >
              <summary>{data.t.manualOverrides}</summary>
              {#if isOverrideExpanded(series.seriesId)}
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
              {/if}
            </details>
          {/if}
        </details>
      {/snippet}

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
    {/if}
  </section>
</main>
