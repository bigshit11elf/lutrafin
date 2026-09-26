<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.t.about} - Lutrafin</title>
</svelte:head>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page legal-page">
    <p class="eyebrow">{data.t.legal}</p>
    <h1>Lutrafin</h1>
    <p class="version-tag">v{data.version}</p>

    <article class="legal-card">
      <h2>{data.t.license}</h2>
      <p>
        <a
          href={data.t.copyrightHolderUrl}
          target="_blank"
          rel="noreferrer noopener">{data.t.copyrightNotice}</a
        >
      </p>
      <p>{data.t.agplNotice}</p>
      <p>
        <a href="/LICENSE.txt" target="_blank" rel="noreferrer noopener"
          >AGPL-3.0-only</a
        >
        ·
        <a href={data.sourceCodeUrl} target="_blank" rel="noreferrer noopener"
          >{data.t.sourceCode}</a
        >
      </p>
    </article>

    <article class="legal-card">
      <h2>{data.t.thirdPartyServices}</h2>
      <p>{data.t.providerIndependence}</p>
      <p><strong>Jellyfin</strong> is used as the local media server API.</p>
      <p>
        <span class="tmdb-badge" aria-label="TMDB">TMDB</span>
        {data.t.tmdbAttribution}
      </p>
      <p>
        <a
          href="https://www.tvmaze.com/"
          target="_blank"
          rel="noreferrer noopener">TVmaze</a
        >
        · {data.t.tvmazeAttribution}
      </p>
      <p>TVDB support is optional and depends on local configuration.</p>
    </article>

    <article class="legal-card">
      <h2>{data.t.thirdPartyNotices}</h2>
      <p>
        <a
          href="/THIRD_PARTY_NOTICES.md"
          target="_blank"
          rel="noreferrer noopener">THIRD_PARTY_NOTICES.md</a
        >
      </p>
    </article>
  </section>
</main>
