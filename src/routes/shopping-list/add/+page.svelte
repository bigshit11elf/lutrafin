<script lang="ts">
  import { goto } from '$app/navigation';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally - initial input value comes from SSR query data and is synchronized after navigation below.
  let searchValue = $state(data.search);
  // svelte-ignore state_referenced_locally - this tracks the last server query value seen by the synchronization effect.
  let serverSearchValue = $state(data.search);

  const filteredMissing = $derived(filterCandidates(data.missing, searchValue));
  const filteredUpcoming = $derived(
    filterCandidates(data.upcoming, searchValue)
  );

  function filterCandidates<
    T extends { seriesName: string; seasonNumber: number }
  >(candidates: T[], search: string): T[] {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return candidates;

    return candidates.filter(
      (candidate) =>
        candidate.seriesName.toLowerCase().includes(normalizedSearch) ||
        `s${String(candidate.seasonNumber).padStart(2, '0')}`.includes(
          normalizedSearch
        ) ||
        String(candidate.seasonNumber).includes(normalizedSearch)
    );
  }

  function searchHref(value: string): string {
    const params = new URLSearchParams();
    if (value.trim()) params.set('q', value.trim());
    const query = params.toString();
    return query ? `/shopping-list/add?${query}` : '/shopping-list/add';
  }

  function addAllHref(filter: 'new-season' | 'announced'): string {
    const params = new URLSearchParams();
    params.set('filter', filter);
    if (searchValue.trim()) params.set('q', searchValue.trim());
    params.set('returnTo', searchHref(searchValue));
    return `/shopping-list/add/from-overview?${params.toString()}`;
  }

  $effect(() => {
    if (serverSearchValue !== data.search) {
      serverSearchValue = data.search;
      searchValue = data.search;
    }
  });

  $effect(() => {
    if (searchValue === serverSearchValue) return;

    const timer = setTimeout(() => {
      const href = searchHref(searchValue);
      void goto(href, { keepFocus: true });
    }, 60);

    return () => clearTimeout(timer);
  });
</script>

<main class="detail-page">
  <a class="back-link" href="/shopping-list">← {data.t.shoppingList}</a>
  <section class="panel sync-page">
    <div class="panel-heading shopping-heading">
      <div>
        <p class="eyebrow">{data.t.shoppingList}</p>
        <h1>{data.t.addToShoppingList}</h1>
      </div>
      {#if data.admin}
        <div class="actions">
          <PostAction
            class="button secondary settings-action"
            href={addAllHref('new-season')}>{data.t.addAllNew}</PostAction
          >
          <PostAction
            class="button secondary settings-action"
            href={addAllHref('announced')}>{data.t.addAllAnnounced}</PostAction
          >
        </div>
      {/if}
    </div>

    <form
      method="GET"
      action="/shopping-list/add"
      class="search-sort shopping-search"
    >
      <label>
        <span>{data.t.search}</span>
        <input
          type="search"
          name="q"
          bind:value={searchValue}
          placeholder={data.t.searchSeries}
        />
      </label>
      <button class="button secondary" type="submit">{data.t.apply}</button>
      {#if searchValue.trim()}
        <a class="button secondary" href="/shopping-list/add">{data.t.reset}</a>
      {/if}
    </form>
    <p class="muted">
      {filteredMissing.length + filteredUpcoming.length} / {data.missing
        .length + data.upcoming.length}
      {data.t.shown}
    </p>

    <section class="settings-form">
      <h2>{data.t.newSeasons}</h2>
      <div class="shopping-list">
        {#each filteredMissing as item}
          <article class="shopping-item">
            <div class="poster shopping-poster" aria-hidden="true">
              {#if item.posterUrl}<img
                  src={item.posterUrl}
                  alt=""
                />{:else}<span>{item.seriesName.slice(0, 1)}</span>{/if}
            </div>
            <div>
              <strong>{item.seriesName}</strong>
              <p>
                {data.t.season} S{String(item.seasonNumber).padStart(2, '0')}
              </p>
              {#if item.sourceUrl}<a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  >{item.sourceLabel ?? data.t.sourceOpen}</a
                >{/if}
            </div>
            {#if data.admin}<PostAction
                class="button secondary settings-action"
                href={`/shopping-list/add/series/${item.mediaEntityId}/missing?season=${item.seasonNumber}&returnTo=/shopping-list`}
                >+</PostAction
              >{/if}
          </article>
        {/each}
      </div>
    </section>

    <section class="settings-form">
      <h2>{data.t.announced}</h2>
      <div class="shopping-list">
        {#each filteredUpcoming as item}
          <article class="shopping-item">
            <div class="poster shopping-poster" aria-hidden="true">
              {#if item.posterUrl}<img
                  src={item.posterUrl}
                  alt=""
                />{:else}<span>{item.seriesName.slice(0, 1)}</span>{/if}
            </div>
            <div>
              <strong>{item.seriesName}</strong>
              <p>
                {data.t.season} S{String(item.seasonNumber).padStart(2, '0')}
              </p>
              {#if item.sourceUrl}<a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  >{item.sourceLabel ?? data.t.sourceOpen}</a
                >{/if}
            </div>
            {#if data.admin}<PostAction
                class="button secondary settings-action"
                href={`/shopping-list/add/series/${item.mediaEntityId}/upcoming?season=${item.seasonNumber}&returnTo=/shopping-list`}
                >+</PostAction
              >{/if}
          </article>
        {/each}
      </div>
    </section>
  </section>
</main>
