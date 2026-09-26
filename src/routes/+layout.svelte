<script lang="ts">
  import '../styles/app.css';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import PostAction from '$lib/components/PostAction.svelte';
  import type { LayoutData } from './$types';
  import logoUrl from '../icon/lutrafin_logo.png';

  let {
    children,
    data
  }: { children: import('svelte').Snippet; data: LayoutData } = $props();

  let contentElement: HTMLElement;
  let contentCanScroll = $state(false);
  let mobileMenuOpen = $state(false);
  let brandIntroVisible = $state(false);
  let scrollToTopAfterNavigation = false;
  let brandIntroFallback: ReturnType<typeof setTimeout> | undefined;

  function pathOnly(href: string) {
    return href.split('?')[0];
  }

  const isCurrent = (href: string) =>
    pathOnly(href) === '/'
      ? data.currentPath === '/'
      : data.currentPath === pathOnly(href) ||
        data.currentPath.startsWith(`${pathOnly(href)}/`);

  const navItems = $derived([
    {
      href: '/',
      label: data.t.overview,
      icon: 'M3 11.5 12 4l9 7.5M5 10.5V20h5v-5h4v5h5v-9.5'
    },
    {
      href: '/sync',
      label: data.t.syncStatus,
      icon: 'M4 7h11l-3-3m8 13H9l3 3M5 17a7 7 0 0 1 11-8M19 7a7 7 0 0 1-11 8'
    },
    {
      href: '/metadata/status',
      label: data.t.metadataStatus,
      icon: 'M6 3h9l3 3v15H6V3zm8 0v4h4M9 11h6M9 15h6M9 19h4'
    },
    {
      href: '/episode-check?collapsed=1',
      label: data.t.episodeCheck,
      icon: 'M5 4h14v16H5V4zm4 4h6M9 12h6M9 16h3'
    },
    {
      href: '/shopping-list',
      label: data.t.shoppingList,
      icon: 'M7 6h14l-2 8H8L7 6zM7 6 6 3H3m6 15.5h.01M18 18.5h.01'
    }
  ]);

  function updateContentScrollState() {
    if (!contentElement) return;
    contentCanScroll =
      contentElement.scrollHeight > contentElement.clientHeight + 1;
  }

  function scrollContentToTop() {
    contentElement?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollContentToTopInstantly() {
    contentElement?.scrollTo({ top: 0, behavior: 'auto' });
  }

  function markSidebarNavigation() {
    scrollToTopAfterNavigation = true;
    mobileMenuOpen = false;
  }

  function finishBrandIntro() {
    if (!brandIntroVisible) return;
    brandIntroVisible = false;
    if (brandIntroFallback) clearTimeout(brandIntroFallback);
  }

  afterNavigate(() => {
    if (!scrollToTopAfterNavigation) return;
    scrollToTopAfterNavigation = false;
    requestAnimationFrame(scrollContentToTopInstantly);
  });

  onMount(() => {
    const introPlayedKey = 'lutrafin.brandIntroPlayed';
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const referrer = document.referrer ? new URL(document.referrer) : undefined;
    const externalEntry =
      !referrer || referrer.origin !== window.location.origin;
    if (
      externalEntry &&
      !reducedMotion &&
      sessionStorage.getItem(introPlayedKey) !== 'true'
    ) {
      sessionStorage.setItem(introPlayedKey, 'true');
      brandIntroVisible = true;
      brandIntroFallback = setTimeout(finishBrandIntro, 1800);
    }

    updateContentScrollState();
    const resizeObserver = new ResizeObserver(updateContentScrollState);
    const mutationObserver = new MutationObserver(updateContentScrollState);
    resizeObserver.observe(contentElement);
    mutationObserver.observe(contentElement, {
      childList: true,
      subtree: true
    });
    window.addEventListener('resize', updateContentScrollState);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateContentScrollState);
      if (brandIntroFallback) clearTimeout(brandIntroFallback);
    };
  });
</script>

<svelte:head>
  <link rel="icon" type="image/png" href={logoUrl} />
</svelte:head>

<main class="app-shell">
  <button
    class="mobile-menu-toggle"
    type="button"
    aria-label={data.t.menu}
    aria-expanded={mobileMenuOpen}
    onclick={() => (mobileMenuOpen = true)}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>
  {#if mobileMenuOpen}
    <button
      class="mobile-menu-backdrop"
      type="button"
      aria-label={data.t.close}
      onclick={() => (mobileMenuOpen = false)}
    ></button>
  {/if}
  <aside
    class="sidebar"
    data-mobile-open={mobileMenuOpen}
    aria-label="Primary navigation"
  >
    <div>
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <img src={logoUrl} alt="" />
        </div>
        <div>
          <strong>Lutrafin</strong>
          <span>{data.t.seriesMonitor}</span>
        </div>
        <button
          class="mobile-menu-close"
          type="button"
          aria-label={data.t.close}
          onclick={() => (mobileMenuOpen = false)}>×</button
        >
      </div>
      <nav>
        {#each navItems as item}
          <a
            href={item.href}
            aria-current={isCurrent(item.href) ? 'page' : undefined}
            onclick={markSidebarNavigation}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path d={item.icon}></path></svg
            ><span>{item.label}</span></a
          >
        {/each}
        {#if data.admin}<a
            href="/settings"
            aria-current={isCurrent('/settings') ? 'page' : undefined}
            onclick={markSidebarNavigation}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm8.5 3.5a8.5 8.5 0 0 0-.1-1.3l2-1.5-2-3.5-2.4 1a8.1 8.1 0 0 0-2.2-1.3L15.5 3h-7l-.4 2.9c-.8.3-1.5.8-2.2 1.3l-2.4-1-2 3.5 2 1.5a8.5 8.5 0 0 0 0 2.6l-2 1.5 2 3.5 2.4-1c.7.6 1.4 1 2.2 1.3l.4 2.9h7l.4-2.9c.8-.3 1.5-.8 2.2-1.3l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.3z"
              ></path></svg
            ><span>{data.t.settings}</span></a
          >{/if}
        <a
          href="/about"
          aria-current={isCurrent('/about') ? 'page' : undefined}
          onclick={markSidebarNavigation}
          ><svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M12 17v-6m0-4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
            ></path></svg
          ><span>{data.t.about}</span></a
        >
      </nav>
    </div>

    <div class="sidebar-footer">
      {#if data.admin}<PostAction href="/logout" class="link-button"
          >{data.t.logout}</PostAction
        >{:else}<a href="/login">{data.t.login}</a>{/if}
      <div class="theme-switcher compact" aria-label="Theme">
        <PostAction
          data-theme-option="system"
          href={`/theme/system?returnTo=${encodeURIComponent(data.currentFullPath)}`}
          title={data.t.system}
          aria-label={data.t.system}>◐</PostAction
        >
        <PostAction
          data-theme-option="light"
          href={`/theme/light?returnTo=${encodeURIComponent(data.currentFullPath)}`}
          title={data.t.light}
          aria-label={data.t.light}>☼</PostAction
        >
        <PostAction
          data-theme-option="dark"
          href={`/theme/dark?returnTo=${encodeURIComponent(data.currentFullPath)}`}
          title={data.t.dark}
          aria-label={data.t.dark}>☾</PostAction
        >
      </div>
      <p class="version-tag">v{data.version}</p>
    </div>
  </aside>

  <section class="content" bind:this={contentElement}>
    {@render children()}
  </section>
</main>

{#if brandIntroVisible}
  <div
    class="brand-intro-overlay"
    aria-hidden="true"
    onanimationend={finishBrandIntro}
  >
    <img class="brand-intro-logo" src={logoUrl} alt="" />
  </div>
{/if}

{#if contentCanScroll}
  <button
    class="back-to-top"
    type="button"
    aria-label={data.t.backToTop}
    title={data.t.backToTop}
    onclick={scrollContentToTop}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"
      ><path d="M12 5l-7 7m7-7 7 7M12 5v14"></path></svg
    >
  </button>
{/if}

{#if data.shoppingAddedCount > 0}
  <div class="dialog-overlay" role="presentation">
    <div
      class="dialog-card compact-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopping-added-title"
    >
      <p class="eyebrow">{data.t.shoppingList}</p>
      <h2 id="shopping-added-title">{data.t.shoppingListAdded}</h2>
      <p>{data.t.shoppingListAddedConfirm}</p>
      <div class="actions dialog-actions">
        <a class="button add-action" href={data.shoppingAddedDismissPath}
          >{data.t.okay}</a
        >
      </div>
    </div>
  </div>
{/if}
