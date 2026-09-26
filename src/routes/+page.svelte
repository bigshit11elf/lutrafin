<script lang="ts">
  import { goto } from '$app/navigation';
  import DateTime from '$lib/components/DateTime.svelte';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';

  function initialSearchValue(pageData: PageData): string {
    return pageData.overview.query.search;
  }

  let { data }: { data: PageData } = $props();
  // svelte-ignore state_referenced_locally - initial input value comes from SSR data and is synchronized after navigation below.
  let searchValue = $state(initialSearchValue(data));
  // svelte-ignore state_referenced_locally - this tracks the last server query value seen by the synchronization effect.
  let serverSearchValue = $state(initialSearchValue(data));

  $effect(() => {
    if (serverSearchValue !== data.overview.query.search) {
      serverSearchValue = data.overview.query.search;
      searchValue = data.overview.query.search;
    }
  });

  $effect(() => {
    if (searchValue === serverSearchValue) return;

    const timer = setTimeout(() => {
      const href = searchHref(searchValue);
      if (href !== data.currentPath) void goto(href, { keepFocus: true });
    }, 60);

    return () => clearTimeout(timer);
  });

  function searchHref(value: string): string {
    const params = new URLSearchParams();
    if (data.overview.query.filter !== 'all')
      params.set('filter', data.overview.query.filter);
    if (value.trim()) params.set('q', value.trim());
    if (data.overview.query.sort !== 'name-asc')
      params.set('sort', data.overview.query.sort);
    if (
      data.streamingGroupsEnabled &&
      data.overview.query.filter === 'new-season'
    )
      params.set('streamingGroups', '1');
    const query = params.toString();
    return query ? `/?${query}` : '/';
  }

  function seasonLabel(seasons: number[]): string {
    if (seasons.length === 0) {
      return data.t.noRegularSeasons;
    }

    return seasons
      .map((season) => `S${String(season).padStart(2, '0')}`)
      .join(', ');
  }

  function healthLabel(health: string): string {
    switch (health) {
      case 'ok':
        return data.t.metadataChecked;
      case 'error':
        return data.t.providerError;
      case 'unresolved':
        return data.t.metadataUnresolved;
      default:
        return data.t.notChecked;
    }
  }

  function statusLabel(status: string): string {
    if (status === 'continuing') return data.t.statusContinuing;
    if (status === 'ended') return data.t.statusEnded;
    if (status === 'announced') return data.t.statusAnnounced;
    return data.t.statusUnknown;
  }

  function filterLabel(filter: string): string {
    if (filter === 'metadata-issues') return data.t.metadataIssues;
    if (filter === 'new-season') return data.t.newSeasons;
    if (filter === 'ignored') return data.t.ignored;
    if (filter === 'all') return data.t.all;
    if (filter === 'continuing') return data.t.continuing;
    if (filter === 'ended') return data.t.ended;
    if (filter === 'announced') return data.t.announced;
    if (filter === 'gaps') return data.t.gaps;
    return filter;
  }

  function sortLabel(sort: string): string {
    if (sort === 'name-asc') return data.t.nameAsc;
    if (sort === 'name-desc') return data.t.nameDesc;
    if (sort === 'last-checked') return data.t.lastChecked;
    if (sort === 'status') return data.t.status;
    if (sort === 'missing-seasons') return data.t.missingSeasons;
    return sort;
  }

  const filterOptions = [
    'all',
    'continuing',
    'ended',
    'new-season',
    'announced',
    'gaps',
    'metadata-issues',
    'ignored'
  ] as const;

  const sortOptions = [
    'name-asc',
    'name-desc',
    'last-checked',
    'status',
    'missing-seasons'
  ] as const;

  function filterHref(filter: string): string {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (searchValue.trim()) params.set('q', searchValue.trim());
    if (data.overview.query.sort !== 'name-asc')
      params.set('sort', data.overview.query.sort);
    if (data.streamingGroupsEnabled && filter === 'new-season')
      params.set('streamingGroups', '1');
    const query = params.toString();
    return query ? `/?${query}` : '/';
  }

  function streamingGroupsHref(enabled: boolean): string {
    const params = new URLSearchParams();
    params.set('filter', 'new-season');
    if (data.overview.query.search) params.set('q', data.overview.query.search);
    if (data.overview.query.sort !== 'name-asc')
      params.set('sort', data.overview.query.sort);
    if (enabled) params.set('streamingGroups', '1');
    const query = params.toString();
    return query ? `/?${query}` : '/?filter=new-season';
  }

  function shoppingListAddHref(): string {
    const params = new URLSearchParams();
    params.set('filter', data.overview.query.filter);
    if (data.overview.query.search) params.set('q', data.overview.query.search);
    if (data.overview.query.sort !== 'name-asc')
      params.set('sort', data.overview.query.sort);
    params.set('returnTo', data.currentPath);
    return `/shopping-list/add/from-overview?${params.toString()}`;
  }
</script>

<svelte:head>
  <title>Lutrafin</title>
  <meta
    name="description"
    content="Selfhosted read-only Jellyfin series status monitor"
  />
</svelte:head>

<section>
  <header class="topbar">
    <div>
      <p class="eyebrow">{data.t.pageEyebrowOverview}</p>
      <h1>{data.t.pageTitleOverview}</h1>
    </div>
    <div class="topbar-actions">
      <div class="sync-state" aria-label={data.t.latestSyncStatus}>
        <span
          class:ok={data.latestSync?.status === 'success'}
          class:failed={data.latestSync?.status === 'failed'}
          class="status-dot"
          aria-hidden="true"
        ></span>
        {#if data.latestSync}
          {data.t.lastSyncAttempt}: <DateTime
            value={data.latestSync.startedAt}
            language={data.language}
            fallback={data.latestSync.startedAt}
          />
        {:else}
          {data.t.noSyncRunYet}
        {/if}
      </div>
      {#if data.admin}
        <a class="button" href="/sync/pending">{data.t.syncLibrary}</a>
        <div class="metadata-actions" aria-label={data.t.metadataActions}>
          <span>{data.t.metadataActions}</span>
          <a class="button secondary" href="/metadata/refresh/pending"
            >{data.t.refreshDueMetadata}</a
          >
          <a class="button secondary" href="/metadata/refresh/pending?force=1"
            >{data.t.refreshAllMetadata}</a
          >
        </div>
      {/if}
    </div>
  </header>

  <section class="cards" aria-label="Status summary">
    <article class="stat-card">
      <span>{data.t.totalSeries}</span>
      <strong>{data.overview.stats.totalSeries}</strong>
      <small>{data.t.localSnapshotNote}</small>
    </article>
    <article class="stat-card">
      <span>{data.t.upToDate}</span>
      <strong>{data.overview.stats.upToDate}</strong>
      <small>{data.t.upToDateNote}</small>
    </article>
    <article class="stat-card positive">
      <span>{data.t.seriesWithNewSeasons}</span>
      <strong>{data.overview.stats.newSeasonsAvailable}</strong>
      <small>
        {data.overview.stats.newSeasonsTotal}
        {data.t.newSeasonsTotal}
      </small>
    </article>
    <article class="stat-card danger">
      <span>{data.t.metadataIssues}</span>
      <strong>{data.overview.stats.metadataIssues}</strong>
      <small>{data.t.metadataIssuesNote}</small>
    </article>
  </section>

  <section class="toolbar" aria-label="Series filters">
    <form method="GET" class="search-sort">
      {#if data.overview.query.filter !== 'all'}
        <input type="hidden" name="filter" value={data.overview.query.filter} />
      {/if}
      {#if data.streamingGroupsEnabled}
        <input type="hidden" name="streamingGroups" value="1" />
      {/if}
      <label>
        <span>{data.t.search}</span>
        <input
          type="search"
          name="q"
          bind:value={searchValue}
          placeholder={data.t.searchSeries}
        />
      </label>
      <label>
        <span>{data.t.sort}</span>
        <select name="sort" value={data.overview.query.sort}>
          {#each sortOptions as option}
            <option value={option}>{sortLabel(option)}</option>
          {/each}
        </select>
      </label>
      <button class="button secondary" type="submit">{data.t.apply}</button>
      {#if searchValue.trim()}
        <a class="button secondary" href={searchHref('')}>{data.t.reset}</a>
      {/if}
    </form>

    <div class="filter-chips" aria-label="Status filter">
      {#each filterOptions as option}
        <a
          href={filterHref(option)}
          aria-current={data.overview.query.filter === option
            ? 'true'
            : undefined}
        >
          {filterLabel(option)} ({data.overview.filterCounts[option]})
        </a>
      {/each}
    </div>
  </section>

  <section class="overview-grid">
    <section class="series-panel" aria-label="Series overview">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">{data.t.series}</p>
          <h2>{data.t.localSnapshot}</h2>
        </div>
        <div class="panel-heading-actions">
          <span>{data.overview.series.length} {data.t.shown}</span>
          {#if data.overview.query.filter === 'new-season' && data.overview.series.length > 0 && data.streamingGroupingAvailable}
            <a
              class="button secondary settings-action compact"
              data-state={data.streamingGroupsEnabled ? 'on' : 'off'}
              href={streamingGroupsHref(!data.streamingGroupsEnabled)}
              >{data.streamingGroupsEnabled
                ? data.t.showUngroupedSeasons
                : data.t.groupByStreamingProvider}</a
            >
          {/if}
          {#if data.admin && (data.overview.query.filter === 'new-season' || data.overview.query.filter === 'announced') && data.overview.series.length > 0}
            <PostAction
              class="button secondary settings-action compact"
              href={shoppingListAddHref()}
              >{data.t.addShownToShoppingList}</PostAction
            >
          {/if}
        </div>
      </div>

      {#if data.overview.series.length === 0}
        <div class="empty-state">
          <h3>{data.t.noSeriesFound}</h3>
          <p>
            {data.t.noSeriesEmpty}
          </p>
        </div>
      {:else if data.streamingGroupsEnabled && data.streamingGroups}
        <div class="streaming-group-list">
          {#each data.streamingGroups as group}
            <section class="streaming-group">
              <h3>{group.label}</h3>
              <div class="series-list compact-series-list">
                {#each group.items as item}
                  <a
                    class="series-row streaming-group-row"
                    href={`/series/${item.id}?returnTo=${encodeURIComponent(data.currentPath)}`}
                  >
                    <div class="poster" aria-hidden="true">
                      {#if item.posterUrl}
                        <img src={item.posterUrl} alt="" loading="lazy" />
                      {:else}
                        <span>{item.name.slice(0, 1)}</span>
                      {/if}
                    </div>
                    <div class="series-main">
                      <div class="series-title-line">
                        <h3>{item.name}</h3>
                        {#if item.productionYear}
                          <span>{item.productionYear}</span>
                        {/if}
                      </div>
                      <p>
                        {data.t.newSeasons}: {seasonLabel(
                          item.missingSeasonNumbers
                        )}
                      </p>
                    </div>
                    <span class="chevron" aria-hidden="true">›</span>
                  </a>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {:else}
        <div class="series-list">
          {#each data.overview.series as item}
            <a
              class="series-row"
              href={`/series/${item.id}?returnTo=${encodeURIComponent(data.currentPath)}`}
            >
              <div class="poster" aria-hidden="true">
                {#if item.posterUrl}
                  <img src={item.posterUrl} alt="" loading="lazy" />
                {:else}
                  <span>{item.name.slice(0, 1)}</span>
                {/if}
              </div>
              <div class="series-main">
                <div class="series-title-line">
                  <h3>{item.name}</h3>
                  {#if item.productionYear}
                    <span>{item.productionYear}</span>
                  {/if}
                </div>
                <p>{data.t.local}: {seasonLabel(item.localSeasonNumbers)}</p>
                <div class="badges" aria-label="Series status">
                  <span class="badge neutral"
                    >{statusLabel(item.normalizedStatus)}</span
                  >
                  <span
                    class:danger={item.metadataHealth === 'error'}
                    class="badge"
                  >
                    {healthLabel(item.metadataHealth)}
                  </span>
                </div>
              </div>
              {#if item.missingSeasonNumbers.length > 0 || item.announcedSeasonNumbers.length > 0}
                <div class="series-indicators" aria-label="Season indicators">
                  {#if item.missingSeasonNumbers.length > 0}
                    <span class="count-badge new" title={data.t.newSeasons}
                      ><strong>{item.missingSeasonNumbers.length}</strong>
                      {data.t.newSeasons}</span
                    >
                  {/if}
                  {#if item.announcedSeasonNumbers.length > 0}
                    <span class="count-badge announced" title={data.t.announced}
                      ><strong>{item.announcedSeasonNumbers.length}</strong>
                      {data.t.announced}</span
                    >
                  {/if}
                </div>
              {/if}
              <span class="chevron" aria-hidden="true">›</span>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  </section>
</section>
