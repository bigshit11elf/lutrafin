<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<main class="detail-page">
  <a class="back-link" href="/">← {data.t.backToOverview}</a>
  <section class="detail-grid providers-grid">
    {#each data.providers as provider}
      <article class="panel">
        <h1>{provider.name}</h1>
        <p>{provider.purpose}</p>
        <span class="badge" class:neutral={provider.configured}
          >{provider.configured
            ? data.t.configured
            : data.t.notConfigured}</span
        >
      </article>
    {/each}
  </section>
</main>
