<script lang="ts">
  import PostAction from '$lib/components/PostAction.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<main class="detail-page shopping-page">
  <a class="back-link print-hidden" href="/">← {data.t.backToOverview}</a>
  <section class="panel sync-page shopping-print-panel">
    <div class="panel-heading shopping-heading">
      <div>
        <p class="eyebrow">{data.t.shoppingList}</p>
        <h1>{data.t.shoppingList}</h1>
      </div>
      <div class="actions print-hidden">
        {#if data.admin}
          <a class="button add-action" href="/shopping-list/add">+</a>
          <a class="button secondary" href="/shopping-list?confirmClear=1"
            >{data.t.clearShoppingList}</a
          >
        {/if}
        <a
          class="button secondary settings-action"
          href="/shopping-list/export.csv">{data.t.exportCsv}</a
        >
        <button
          class="button secondary settings-action"
          onclick={() => window.print()}>{data.t.print}</button
        >
      </div>
    </div>

    {#if data.items.length === 0}
      <p class="muted">{data.t.shoppingListEmpty}</p>
    {:else}
      <div class="shopping-list">
        {#each data.items as item}
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
                {data.t.season} S{String(item.seasonNumber).padStart(2, '0')} · {item.status ===
                'missing'
                  ? data.t.missing
                  : data.t.upcoming}
              </p>
              {#if item.sourceUrl}<a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  >{item.sourceLabel ?? data.t.sourceOpen}</a
                >{/if}
            </div>
            <div class="shopping-controls print-hidden">
              <span>{data.t.priority} {item.priority}</span>
              {#if data.admin}
                <PostAction
                  class="button secondary settings-action"
                  href={`/shopping-list/${item.id}/up`}
                  >{data.t.moveUp}</PostAction
                >
                <PostAction
                  class="button secondary settings-action"
                  href={`/shopping-list/${item.id}/down`}
                  >{data.t.moveDown}</PostAction
                >
                <PostAction
                  class="button secondary settings-action"
                  href={`/shopping-list/${item.id}/remove`}
                  >{data.t.remove}</PostAction
                >
              {/if}
            </div>
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
        aria-labelledby="clear-shopping-list-title"
      >
        <p class="eyebrow">{data.t.shoppingList}</p>
        <h2 id="clear-shopping-list-title">{data.t.clearShoppingList}</h2>
        <p>{data.t.clearShoppingListConfirm}</p>
        <div class="actions dialog-actions">
          <a class="button secondary" href="/shopping-list">{data.t.cancel}</a>
          <PostAction
            class="button clear-action"
            href="/shopping-list/clear/run">{data.t.clear}</PostAction
          >
        </div>
      </div>
    </div>
  {/if}
</main>
