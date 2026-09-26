<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally - initial input value comes from SSR query data and is synchronized after navigation below.
  let seriesSearch = $state(data.seriesSearch);
  // svelte-ignore state_referenced_locally - this tracks the last server query value seen by the synchronization effect.
  let serverSeriesSearch = $state(data.seriesSearch);
  let settingsFeedback = $state<{
    title: string;
    message: string;
  } | null>(null);
  let revealedSecrets = $state(new Set<string>());

  const installedLanguages = $derived([
    { id: 'en', label: 'English' },
    { id: 'de', label: 'Deutsch' }
  ]);

  const intervalLabel = (interval: string) => {
    if (interval === 'off') return data.t.disabled;
    if (interval === '1h') return data.t.everyHour;
    if (interval === '3h') return data.t.every3Hours;
    if (interval === '6h') return data.t.every6Hours;
    if (interval === '12h') return data.t.every12Hours;
    if (interval === '24h') return data.t.daily;
    if (interval === '7d') return data.t.weekly;
    if (interval === '14d') return data.t.every14Days;
    if (interval === '30d') return data.t.monthly;
    return interval;
  };

  const eventLabel = (event: string) => {
    if (event === 'season_announced') return data.t.seasonAnnounced;
    if (event === 'season_released') return data.t.seasonReleased;
    return event;
  };

  const filteredSeries = $derived(
    data.series.filter((series) =>
      series.name.toLowerCase().includes(seriesSearch.trim().toLowerCase())
    )
  );

  const secretInputType = (name: string) =>
    revealedSecrets.has(name) ? 'text' : 'password';

  function setSecretRevealed(name: string, revealed: boolean) {
    const next = new Set(revealedSecrets);
    if (revealed) next.add(name);
    else next.delete(name);
    revealedSecrets = next;
  }

  function jsonBody(formData: FormData) {
    const body: Record<string, string | string[]> = {};
    for (const [key, value] of formData.entries()) {
      const stringValue = String(value);
      const existing = body[key];
      if (existing === undefined) {
        body[key] = stringValue;
      } else if (Array.isArray(existing)) {
        existing.push(stringValue);
      } else {
        body[key] = [existing, stringValue];
      }
    }
    return body;
  }

  async function submitJsonForm(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const submitter = event.submitter as HTMLButtonElement | null;
    const action = submitter?.value ?? 'save';
    const notificationForm = form.id === 'notification-settings-form';
    const formData = new FormData(form);
    if (submitter?.name) formData.set(submitter.name, submitter.value);

    const response = await fetch(form.getAttribute('action') ?? '', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify(jsonBody(formData)),
      redirect: 'follow'
    });
    const result = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? ((await response.json()) as { testCount?: number })
      : {};

    if (response.ok && !response.redirected) {
      settingsFeedback = {
        title: notificationForm ? data.t.notifications : data.t.automation,
        message: notificationForm
          ? action === 'test'
            ? result.testCount && result.testCount > 0
              ? data.t.testNotificationSent
              : data.t.noNotificationProviderReady
            : action.startsWith('reset:')
              ? data.t.notificationProviderReset
              : data.t.notificationsSaved
          : data.t.automationSaved
      };
      await invalidateAll();
      return;
    }

    if (response.redirected) {
      const url = new URL(response.url);
      await goto(url.pathname + url.search + url.hash, {
        invalidateAll: true,
        noScroll: true
      });
    } else if (response.ok) {
      await goto(location.pathname + location.search + location.hash, {
        invalidateAll: true,
        noScroll: true
      });
    } else {
      throw new Error(`Settings update failed with HTTP ${response.status}`);
    }
  }

  $effect(() => {
    if (serverSeriesSearch !== data.seriesSearch) {
      serverSeriesSearch = data.seriesSearch;
      seriesSearch = data.seriesSearch;
    }
  });

  $effect(() => {
    if (seriesSearch === serverSeriesSearch) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (seriesSearch.trim()) params.set('seriesSearch', seriesSearch.trim());
      const query = params.toString();
      const href = query
        ? `/settings?${query}#ignored-series`
        : '/settings#ignored-series';

      void goto(href, { keepFocus: true });
    }, 60);

    return () => clearTimeout(timer);
  });
</script>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">{data.t.settings}</p>
        <h1>{data.t.settings}</h1>
      </div>
    </div>

    <div class="settings-grid">
      <section
        id="language"
        class="settings-form settings-card compact-settings-card"
      >
        <h2>{data.t.language}</h2>
        <div class="settings-list">
          {#each installedLanguages as language}
            <article class="settings-row compact-row">
              <div>
                <strong>{language.label}</strong>
              </div>
              <PostAction
                class="switch-link"
                aria-label={language.label}
                data-state={data.language === language.id ? 'on' : 'off'}
                href={`/settings/language/${language.id}?returnTo=/settings%23language`}
                ><span></span></PostAction
              >
            </article>
          {/each}
        </div>
      </section>

      <section
        id="region"
        class="settings-form settings-card compact-settings-card"
      >
        <h2>{data.t.region}</h2>
        <div class="settings-list">
          {#each data.regions as region}
            <article class="settings-row compact-row">
              <div>
                <strong>{region.label}</strong>
              </div>
              <PostAction
                class="switch-link"
                aria-label={region.label}
                data-state={data.region === region.id ? 'on' : 'off'}
                href={`/settings/region/${region.id}?returnTo=/settings%23region`}
                ><span></span></PostAction
              >
            </article>
          {/each}
        </div>
      </section>

      <section
        id="diagnostics"
        class="settings-form settings-card compact-settings-card"
      >
        <h2>{data.t.diagnostics}</h2>
        <div class="settings-list">
          <article class="settings-row">
            <div>
              <strong>{data.t.seasonDiagnostics}</strong>
              <span>{data.t.seasonDiagnosticsDescription}</span>
            </div>
            <PostAction
              class="switch-link"
              aria-label={data.seasonDiagnosticsEnabled
                ? data.t.disable
                : data.t.enable}
              data-state={data.seasonDiagnosticsEnabled ? 'on' : 'off'}
              href={`/settings/diagnostics/${data.seasonDiagnosticsEnabled ? 'disable' : 'enable'}?returnTo=/settings%23diagnostics`}
              ><span></span></PostAction
            >
          </article>
        </div>
      </section>

      <section
        id="automation"
        class="settings-form settings-card priority-settings-card"
      >
        <h2>{data.t.automation}</h2>
        <form
          id="automation-settings-form"
          method="POST"
          action="/settings/metadata-automation?returnTo=/settings%23automation"
          class="settings-list"
          onsubmit={submitJsonForm}
        >
          <label class="settings-field">
            <span>{data.t.librarySyncInterval}</span>
            <small>{data.t.librarySyncIntervalDescription}</small>
            <select name="jellyfinSyncInterval">
              {#each data.jellyfinSyncIntervals as interval}
                <option
                  value={interval}
                  selected={interval === data.jellyfinSyncInterval}
                  >{intervalLabel(interval)}</option
                >
              {/each}
            </select>
          </label>
          <label class="settings-field">
            <span>{data.t.metadataRefreshInterval}</span>
            <small>{data.t.metadataRefreshIntervalDescription}</small>
            <select name="metadataRefreshInterval">
              {#each data.metadataRefreshIntervals as interval}
                <option
                  value={interval}
                  selected={interval === data.metadataRefreshInterval}
                  >{intervalLabel(interval)}</option
                >
              {/each}
            </select>
          </label>
          <label class="settings-field">
            <span>{data.t.metadataFullRefreshInterval}</span>
            <small>{data.t.metadataFullRefreshIntervalDescription}</small>
            <select name="metadataFullRefreshInterval">
              {#each data.metadataFullRefreshIntervals as interval}
                <option
                  value={interval}
                  selected={interval === data.metadataFullRefreshInterval}
                  >{intervalLabel(interval)}</option
                >
              {/each}
            </select>
          </label>
          <button class="button secondary settings-action" type="submit">
            {data.t.save}
          </button>
        </form>
      </section>

      <section
        id="streaming-providers"
        class="settings-form settings-card priority-settings-card"
      >
        <h2>{data.t.streamingProviders}</h2>
        <div class="settings-list">
          <h3 class="settings-subheading">{data.t.display}</h3>
          <article id="streaming-availability" class="settings-row compact-row">
            <div>
              <strong>{data.t.showStreamingInfo}</strong>
              <span>{data.t.showStreamingInfoDescription}</span>
            </div>
            <PostAction
              class="switch-link"
              aria-label={data.streamingAvailabilityEnabled
                ? data.t.disable
                : data.t.enable}
              data-state={data.streamingAvailabilityEnabled ? 'on' : 'off'}
              href={`/settings/display/streaming-availability/${data.streamingAvailabilityEnabled ? 'disable' : 'enable'}?returnTo=/settings%23streaming-availability`}
              ><span></span></PostAction
            >
          </article>
          <article id="amazon-season-links" class="settings-row compact-row">
            <div>
              <strong>{data.t.showAmazonSeasonLinks}</strong>
              <span>{data.t.showAmazonSeasonLinksDescription}</span>
            </div>
            <PostAction
              class="switch-link"
              aria-label={data.amazonSeasonLinksEnabled
                ? data.t.disable
                : data.t.enable}
              data-state={data.amazonSeasonLinksEnabled ? 'on' : 'off'}
              href={`/settings/display/amazon-season-links/${data.amazonSeasonLinksEnabled ? 'disable' : 'enable'}?returnTo=/settings%23amazon-season-links`}
              ><span></span></PostAction
            >
          </article>
          <h3 class="settings-subheading with-divider">{data.t.services}</h3>
          {#each data.streamingProviders as provider}
            <article
              id={`streaming-provider-${provider.id}`}
              class="settings-row compact-row"
            >
              <div>
                <strong>{provider.label}</strong>
              </div>
              <PostAction
                class="switch-link"
                aria-label={provider.enabled ? data.t.disable : data.t.enable}
                data-state={provider.enabled ? 'on' : 'off'}
                href={`/settings/streaming-provider/${provider.id}/${provider.enabled ? 'disable' : 'enable'}?returnTo=${encodeURIComponent(`/settings#streaming-provider-${provider.id}`)}`}
                ><span></span></PostAction
              >
            </article>
          {/each}
        </div>
      </section>
    </div>

    <section id="providers" class="settings-form settings-card wide">
      <h2>{data.t.providers}</h2>
      <div class="settings-list">
        {#each data.providers as provider}
          <article
            id={`provider-${provider.id}`}
            class="settings-row provider-settings-row"
          >
            <div>
              <strong>{provider.name}</strong>
              <span
                >{provider.purpose}{#if provider.id === 'tmdb'}
                  · {data.t.alwaysUsed}{/if}</span
              >
            </div>
            <span
              class="status-label"
              data-state={provider.configured ? 'configured' : 'missing'}
              >{provider.configured
                ? `✓ ${data.t.configured}`
                : data.t.notConfigured}</span
            >
            {#if provider.id !== 'tmdb'}
              <PostAction
                class="switch-link"
                aria-label={provider.enabled ? data.t.disable : data.t.enable}
                data-state={provider.enabled ? 'on' : 'off'}
                href={`/settings/provider/${provider.id}/${provider.enabled ? 'disable' : 'enable'}?returnTo=${encodeURIComponent(`/settings#provider-${provider.id}`)}`}
                ><span></span></PostAction
              >
            {/if}
          </article>
        {/each}
      </div>
    </section>

    <section id="notifications" class="settings-form settings-card wide">
      <h2>{data.t.notifications}</h2>
      <form
        id="notification-settings-form"
        method="POST"
        action="/settings/notifications?returnTo=/settings%23notifications"
        class="settings-list notification-settings-form"
        onsubmit={submitJsonForm}
      >
        <fieldset class="settings-fieldset notification-events-card">
          <legend>{data.t.notificationEvents}</legend>
          {#each data.notificationEventTypes as event}
            <label class="switch-field">
              <input
                type="checkbox"
                name="eventTypes"
                value={event.id}
                checked={event.enabled}
              />
              <span
                class="switch-link"
                data-state={event.enabled ? 'on' : 'off'}><span></span></span
              >
              <span>{eventLabel(event.id)}</span>
            </label>
          {/each}
        </fieldset>
        <p class="muted">{data.t.configuredSecretHelp}</p>
        {#each data.notificationProviders as provider}
          <fieldset
            class="notification-provider-card"
            data-provider={provider.id}
          >
            <legend>{provider.label}</legend>
            <label class="switch-field notification-provider-enabled">
              <input
                type="checkbox"
                name={`${provider.id}.enabled`}
                checked={provider.enabled}
              />
              <span
                class="switch-link"
                data-state={provider.enabled ? 'on' : 'off'}><span></span></span
              >
              <span>{data.t.enabled}</span>
            </label>
            <button
              class="button secondary settings-action compact notification-reset"
              name="action"
              value={`reset:${provider.id}`}
              type="submit"
            >
              {data.t.reset}
            </button>
            <span
              class="status-label"
              data-state={provider.configured ? 'configured' : 'missing'}
              >{provider.configured
                ? `✓ ${data.t.configured}`
                : data.t.notConfigured}</span
            >
            {#if provider.id === 'ntfy'}
              <label class="settings-field">
                <span>{data.t.serverUrl}</span>
                <input name="ntfy.serverUrl" value={provider.serverUrl} />
              </label>
              <label class="settings-field">
                <span>{data.t.topic}</span>
                <input name="ntfy.topic" value={provider.topic} />
              </label>
              <label class="settings-field">
                <span>{data.t.token}</span>
                <span class="secret-input-row">
                  <input
                    name="ntfy.token"
                    type={secretInputType('ntfy.token')}
                    autocomplete="off"
                  />
                  <button
                    class="button secondary compact"
                    type="button"
                    aria-label={data.t.revealSecret}
                    onpointerdown={() => setSecretRevealed('ntfy.token', true)}
                    onpointerup={() => setSecretRevealed('ntfy.token', false)}
                    onpointerleave={() =>
                      setSecretRevealed('ntfy.token', false)}
                    onblur={() => setSecretRevealed('ntfy.token', false)}
                    >👁</button
                  >
                </span>
              </label>
            {:else if provider.id === 'gotify'}
              <label class="settings-field">
                <span>{data.t.serverUrl}</span>
                <input name="gotify.serverUrl" value={provider.serverUrl} />
              </label>
              <label class="settings-field">
                <span>{data.t.token}</span>
                <span class="secret-input-row">
                  <input
                    name="gotify.token"
                    type={secretInputType('gotify.token')}
                    autocomplete="off"
                  />
                  <button
                    class="button secondary compact"
                    type="button"
                    aria-label={data.t.revealSecret}
                    onpointerdown={() =>
                      setSecretRevealed('gotify.token', true)}
                    onpointerup={() => setSecretRevealed('gotify.token', false)}
                    onpointerleave={() =>
                      setSecretRevealed('gotify.token', false)}
                    onblur={() => setSecretRevealed('gotify.token', false)}
                    >👁</button
                  >
                </span>
              </label>
              <label class="settings-field">
                <span>{data.t.priority}</span>
                <input
                  name="gotify.priority"
                  type="number"
                  value={provider.priority}
                />
              </label>
            {:else if provider.id === 'pushover'}
              <label class="settings-field">
                <span>{data.t.userKey}</span>
                <input
                  name="pushover.userKey"
                  type={secretInputType('pushover.userKey')}
                  autocomplete="off"
                />
                <button
                  class="button secondary compact"
                  type="button"
                  aria-label={data.t.revealSecret}
                  onpointerdown={() =>
                    setSecretRevealed('pushover.userKey', true)}
                  onpointerup={() =>
                    setSecretRevealed('pushover.userKey', false)}
                  onpointerleave={() =>
                    setSecretRevealed('pushover.userKey', false)}
                  onblur={() => setSecretRevealed('pushover.userKey', false)}
                  >👁</button
                >
              </label>
              <label class="settings-field">
                <span>{data.t.applicationToken}</span>
                <input
                  name="pushover.applicationToken"
                  type={secretInputType('pushover.applicationToken')}
                  autocomplete="off"
                />
                <button
                  class="button secondary compact"
                  type="button"
                  aria-label={data.t.revealSecret}
                  onpointerdown={() =>
                    setSecretRevealed('pushover.applicationToken', true)}
                  onpointerup={() =>
                    setSecretRevealed('pushover.applicationToken', false)}
                  onpointerleave={() =>
                    setSecretRevealed('pushover.applicationToken', false)}
                  onblur={() =>
                    setSecretRevealed('pushover.applicationToken', false)}
                  >👁</button
                >
              </label>
              <label class="settings-field">
                <span>{data.t.device}</span>
                <input name="pushover.device" value={provider.device} />
              </label>
              <label class="settings-field">
                <span>{data.t.priority}</span>
                <input
                  name="pushover.priority"
                  type="number"
                  value={provider.priority}
                />
              </label>
            {:else}
              <label class="settings-field">
                <span>{data.t.webhookUrl}</span>
                <input name="webhook.webhookUrl" value={provider.webhookUrl} />
              </label>
            {/if}
          </fieldset>
        {/each}
        <div class="actions">
          <button
            class="button secondary settings-action"
            name="action"
            value="save"
            type="submit"
          >
            {data.t.saveNotifications}
          </button>
          <button
            class="button secondary settings-action"
            name="action"
            value="test"
            type="submit"
          >
            {data.t.testNotification}
          </button>
        </div>
      </form>
    </section>

    <section id="libraries" class="settings-form settings-card wide">
      <h2>{data.t.libraryBlacklist}</h2>
      {#if data.libraries.length === 0}
        <p class="muted">{data.t.noLibrariesDiscovered}</p>
      {:else}
        <div class="settings-list">
          {#each data.libraries as library}
            {@const excluded = data.excludedLibraryIds.includes(library.id)}
            <article id={`library-${library.id}`} class="settings-row">
              <div>
                <strong>{library.name}</strong>
                <span>{excluded ? data.t.blacklisted : data.t.included}</span>
              </div>
              <PostAction
                class="switch-link"
                aria-label={excluded
                  ? data.t.removeFromBlacklist
                  : data.t.addToBlacklist}
                data-state={excluded ? 'on' : 'off'}
                href={`/settings/library/${library.id}/${excluded ? 'include' : 'exclude'}?returnTo=${encodeURIComponent(`/settings#library-${library.id}`)}`}
                ><span></span></PostAction
              >
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section id="ignored-series" class="settings-form settings-card wide">
      <h2>{data.t.ignoredSeries}</h2>
      <form method="GET" action="/settings" class="search-sort live-search">
        <label>
          <span>{data.t.search}</span>
          <input
            type="search"
            name="seriesSearch"
            bind:value={seriesSearch}
            placeholder={data.t.searchSeries}
          />
        </label>
        <button class="button secondary" type="submit">{data.t.apply}</button>
        {#if seriesSearch.trim()}
          <a class="button secondary" href="/settings#ignored-series"
            >{data.t.reset}</a
          >
        {/if}
      </form>
      <p class="muted">
        {filteredSeries.length} / {data.seriesTotalCount}
        {data.t.shown}
      </p>
      <div class="settings-list">
        {#each filteredSeries as series}
          <article id={`series-${series.id}`} class="settings-row">
            <div>
              <strong>{series.name}</strong>
              <span>{series.ignored ? data.t.ignored : data.t.included}</span>
            </div>
            <PostAction
              class="switch-link"
              aria-label={series.ignored ? data.t.unignore : data.t.ignore}
              data-state={series.ignored ? 'on' : 'off'}
              href={`/settings/series/${series.id}/${series.ignored ? 'unignore' : 'ignore'}?returnTo=${encodeURIComponent(`/settings#series-${series.id}`)}`}
              ><span></span></PostAction
            >
          </article>
        {/each}
      </div>
    </section>
  </section>
</main>

{#if settingsFeedback}
  <div class="dialog-overlay" role="presentation">
    <div
      class="dialog-card compact-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-feedback-title"
    >
      <p class="eyebrow">{data.t.settings}</p>
      <h2 id="settings-feedback-title">{settingsFeedback.title}</h2>
      <p>{settingsFeedback.message}</p>
      <div class="actions dialog-actions">
        <button
          class="button add-action"
          type="button"
          onclick={() => (settingsFeedback = null)}
        >
          {data.t.okay}
        </button>
      </div>
    </div>
  </div>
{/if}
