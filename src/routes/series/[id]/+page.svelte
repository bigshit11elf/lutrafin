<script lang="ts">
  import DateTime from '$lib/components/DateTime.svelte';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const seasonStatusLabel = (status: 'local' | 'missing' | 'upcoming') => {
    if (status === 'local') return data.t.localSeason;
    if (status === 'missing') return data.t.missing;
    return data.t.upcoming;
  };

  const statusLabel = (status: string) => {
    if (status === 'continuing') return data.t.statusContinuing;
    if (status === 'ended') return data.t.statusEnded;
    if (status === 'announced') return data.t.statusAnnounced;
    return data.t.statusUnknown;
  };

  const providerLabel = (provider: string) => {
    if (provider === 'composite') return data.t.providerComposite;
    if (provider === 'tmdb') return data.t.providerTmdb;
    if (provider === 'tvmaze') return data.t.providerTvmaze;
    if (provider === 'tvdb') return data.t.providerTvdb;
    return provider;
  };

  const missingSeasons = $derived(
    data.details.seasons.filter((season) => season.status === 'missing')
  );
  const upcomingSeasons = $derived(
    data.details.seasons.filter((season) => season.status === 'upcoming')
  );
  const localSeasons = $derived(
    data.details.seasons.filter((season) => season.status === 'local')
  );
  const exceptionSeasons = $derived(
    data.details.seasons.filter((season) => season.status !== 'local')
  );

  async function copyProviderId(value: string) {
    await navigator.clipboard?.writeText(value);
  }
</script>

<svelte:head>
  <title>{data.details.name} - Lutrafin</title>
</svelte:head>

<main class="detail-page">
  <a class="back-link" href={data.returnTo}>← {data.t.backToOverview}</a>

  <section class="detail-hero">
    <div class="detail-poster">
      {#if data.details.posterUrl}<img
          src={data.details.posterUrl}
          alt=""
        />{:else}<span>{data.details.name.slice(0, 1)}</span>{/if}
    </div>
    <div class="detail-copy">
      <div>
        <p class="eyebrow">{data.t.series}</p>
        <h1>{data.details.name}</h1>
        {#if data.details.originalTitle && data.details.originalTitle !== data.details.name}<p
            class="muted"
          >
            {data.details.originalTitle}
          </p>{/if}
        <div class="badges">
          <span class="badge neutral"
            >{statusLabel(data.details.normalizedStatus)}</span
          >
          {#if data.details.ignored}<span class="badge neutral"
              >{data.t.ignored}</span
            >{/if}
          {#if data.details.metadataProvider}<span class="badge"
              >{providerLabel(data.details.metadataProvider)}</span
            >{/if}
        </div>
      </div>

      {#if data.admin}
        <div class="actions detail-actions">
          {#if missingSeasons.length > 0 || upcomingSeasons.length > 0}
            <details class="add-season-menu">
              <summary class="button settings-action"
                >{data.t.addSeasons} ▾</summary
              >
              <div class="add-season-options">
                <span>{data.t.shoppingList}</span>
                {#if missingSeasons.length > 0}
                  <PostAction
                    href={`/shopping-list/add/series/${data.details.id}/missing?returnTo=${encodeURIComponent(`/series/${data.details.id}?returnTo=${encodeURIComponent(data.returnTo)}`)}`}
                    >{data.t.addMissingToShoppingList}</PostAction
                  >
                {/if}
                {#if upcomingSeasons.length > 0}
                  <PostAction
                    href={`/shopping-list/add/series/${data.details.id}/upcoming?returnTo=${encodeURIComponent(`/series/${data.details.id}?returnTo=${encodeURIComponent(data.returnTo)}`)}`}
                    >{data.t.addUpcomingToShoppingList}</PostAction
                  >
                {/if}
              </div>
            </details>
          {/if}
          <PostAction
            class="button secondary"
            href={`/settings/series/${data.details.id}/${data.details.ignored ? 'unignore' : 'ignore'}?returnTo=${encodeURIComponent(`/series/${data.details.id}?returnTo=${encodeURIComponent(data.returnTo)}`)}`}
            >{data.details.ignored
              ? data.t.unignore
              : data.t.ignore}</PostAction
          >
        </div>
      {/if}
    </div>
  </section>

  <section class="detail-grid">
    <article class="panel detail-panel seasons-panel">
      <h2>{data.t.seasons}</h2>
      {#if localSeasons.length > 0}
        <div class="season-compact-list">
          {#each localSeasons as season}
            <span class="season-compact" data-status="local"
              >{season.label} ✓</span
            >
          {/each}
        </div>
      {/if}

      {#if exceptionSeasons.length > 0}
        <div class="season-exception-list">
          {#each exceptionSeasons as season}
            {#if season.sourceUrl}
              <a
                class="season-exception"
                data-status={season.status}
                href={season.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <strong>{season.label}</strong>
                <span>{seasonStatusLabel(season.status)}</span>
                {#if season.airDate}<time>{season.airDate}</time>{/if}
              </a>
            {:else}
              <span class="season-exception" data-status={season.status}>
                <strong>{season.label}</strong>
                <span>{seasonStatusLabel(season.status)}</span>
                {#if season.airDate}<time>{season.airDate}</time>{/if}
              </span>
            {/if}
          {/each}
        </div>
      {/if}

      {#if data.details.specialsCount > 0}<p class="muted compact-note">
          {data.t.specialsStoredSeparately}: {data.details.specialsCount}
        </p>{/if}
    </article>

    <article class="panel detail-panel freshness-panel">
      <h2>{data.t.freshness}</h2>
      <dl class="freshness-list">
        <dt>{data.t.lastJellyfinSync}</dt>
        <dd>
          <DateTime
            value={data.details.lastSeenInJellyfinAt}
            language={data.language}
            fallback={data.t.unknown}
          />
        </dd>
        <dt>{data.t.metadataChecked}</dt>
        <dd>
          <DateTime
            value={data.details.metadataLastCheckedAt}
            language={data.language}
            fallback={data.t.never}
          />
        </dd>
        <dt>{data.t.lastMetadataSuccess}</dt>
        <dd>
          <DateTime
            value={data.details.metadataLastSuccessAt}
            language={data.language}
            fallback={data.t.never}
          />
        </dd>
        <dt>{data.t.lastProviderError}</dt>
        <dd>{data.details.metadataErrorCode ?? data.t.none}</dd>
      </dl>
    </article>

    {#if data.newSeasonAvailability.length > 0}
      <article class="panel detail-panel streaming-panel">
        <h2>{data.t.streamingAndShopping}</h2>
        <div class="season-availability-list">
          {#each data.newSeasonAvailability as season}
            <article class="season-availability-row">
              <div class="availability-season-heading">
                <strong>{season.label}</strong>
                {#if season.airDate}<span>{season.airDate}</span>{/if}
              </div>
              <div>
                {#if data.streamingAvailabilityEnabled}
                  {#if season.streamingProviders.length > 0}
                    <div class="availability-provider-list">
                      {#each season.streamingProviders as provider}
                        <div
                          class="availability-provider-row"
                          data-available={provider.available}
                        >
                          <span>{provider.label}</span>
                          <strong data-available={provider.available}
                            >{provider.available
                              ? data.t.available
                              : data.t.unavailable}</strong
                          >
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="muted">{data.t.noStreamingProviders}</p>
                  {/if}
                {/if}
                {#if season.amazonUrl}
                  <div class="availability-actions">
                    <a
                      class="button secondary settings-action"
                      href={season.amazonUrl}
                      target="_blank"
                      rel="noreferrer noopener">{data.t.openAmazonSeason}</a
                    >
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      </article>
    {/if}

    <details
      class="technical-details"
      open={data.admin && data.seasonDiagnosticsEnabled}
    >
      <summary>{data.t.technicalDetails}</summary>
      <div class="technical-details-content">
        <section class="technical-section">
          <h2>{data.t.providerIds}</h2>
          {#if data.details.providerIds.length === 0}<p class="muted">
              {data.t.noProviderIds}
            </p>{/if}
          <dl class="provider-id-list">
            {#each data.details.providerIds as id}<dt>{id.provider}</dt>
              <dd>
                <code>{id.externalId}</code>
                <button
                  class="copy-button"
                  type="button"
                  onclick={() => copyProviderId(id.externalId)}
                  >{data.t.copy}</button
                >
              </dd>{/each}
          </dl>
        </section>

        {#if data.admin && data.seasonDiagnosticsEnabled}
          <section class="technical-section technical-diagnostics">
            <h2>{data.t.seasonDiagnostics}</h2>
            {#if data.details.seasonOverrideSuggestions.length > 0}
              <div
                class="diagnostic-suggestions technical-diagnostic-suggestions"
              >
                {#each data.details.seasonOverrideSuggestions as suggestion}
                  <article>
                    <div>
                      <strong>{data.t.seasonOverrideSuggestion}</strong>
                      <p>
                        {suggestion.displayName}: {suggestion.originalSeasonNumber ??
                          data.t.unknown}
                        → {suggestion.mappedSeasonNumber}
                      </p>
                    </div>
                    <PostAction
                      class="button secondary settings-action compact"
                      href={`/series/${data.details.id}/season-overrides/${suggestion.localSeasonId}/apply?to=${suggestion.mappedSeasonNumber}&returnTo=${encodeURIComponent(`/series/${data.details.id}?returnTo=${encodeURIComponent(data.returnTo)}`)}`}
                      >{data.t.applySeasonOverride}</PostAction
                    >
                  </article>
                {/each}
              </div>
            {/if}
            <div class="diagnostics-table technical-diagnostics-table">
              <div class="diagnostics-head">
                <span>{data.t.source}</span>
                <span>{data.t.season}</span>
                <span>{data.t.name}</span>
                <span>ID</span>
                <span>{data.t.airDate}</span>
              </div>
              {#each data.details.seasonDiagnostics as row}
                <div>
                  <span
                    >{row.source === 'jellyfin'
                      ? 'Jellyfin'
                      : data.t.metadataActions}</span
                  >
                  <span>{row.seasonNumber ?? data.t.unknown}</span>
                  <span
                    >{row.label}{#if row.mappedSeasonNumber}
                      → S{String(row.mappedSeasonNumber).padStart(
                        2,
                        '0'
                      )}{/if}</span
                  >
                  <span>{row.itemId ?? data.t.none}</span>
                  <span>{row.airDate ?? data.t.none}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </details>
  </section>
</main>
