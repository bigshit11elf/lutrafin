# Development Log

## Current State

- Current phase: MVP finalization.
- Last completed: Fixed notification release events, delivery lease recovery, provider error classification, notification secret files and debug logging.
- Build: passing (`npm run build`).
- Tests: passing (`npm run check`, `npm run lint`, `npm test`, 73 tests).
- Database schema version: 0008_delivery_claims_watch_cache.
- Known blocking issues: none known.

## Next Actions

1. Run Docker build when Docker daemon is available.
2. Test against a real Jellyfin/TMDB setup.
3. Continue CSP hardening toward removing `script-src 'unsafe-inline'`.
4. Add admin password change handling if runtime password rotation becomes supported.

## Open Issues

- The UI is still being refined, but overview filters, external metadata status, settings, shopping list and detail pages are implemented.
- Manual sync and in-process scheduled sync/metadata refresh are implemented; Docker runtime testing remains environment-dependent.
- Jellyfin adapter currently uses server-wide API-key style auth; dedicated restricted Jellyfin credentials should be documented further.
- TMDB provider and TVmaze fallback are implemented.
- Docker packaging exists but has not yet been runtime-tested with a real Jellyfin/TMDB configuration.
- Local Docker build could not run because the Docker daemon was unavailable in this session.

## 2026-09-26 - Notification Reliability Follow-Up

### Fixed

- `season_released` events now use the metadata observation window (`previousCheckedAt < airDate <= currentCheckedAt`) so an announced season emits one release event when crossing its air date and later refreshes deduplicate it.
- Notification deliveries now store `claimedAt`; stale `sending` claims older than five minutes can be reclaimed after a process crash.
- Permanent notification failures such as invalid config, non-retryable HTTP 4xx and Pushover API rejection now become exhausted without retry, while timeout/network, 408, 429 and 5xx errors remain retryable.
- POST origin diagnostics are now only logged when `LOG_LEVEL=debug`.

### Added

- Added the dashboard screenshot to the repository and linked it from the README.
- Added optional notification secret inputs through environment variables and `_FILE` paths for ntfy, Gotify, Pushover and Generic Webhook, merged server-side without returning secrets to clients.
- Replaced empty TMDB cache/watch-provider catches with debug-gated, redacted diagnostic logs.
- Added tests for release-event timing/deduplication, stale delivery lease recovery, provider error classification, Pushover rejection and notification `_FILE` secrets.

### Changed

- Documented Generic Webhook private HTTP targets and at-least-once delivery semantics.
- Bumped the app version to `0.2.58`.

### Verification

- `npm run check`: passing.
- `npm run lint`: passing.
- `npm test`: passing, 78 tests.
- `npm run build`: passing.
- `npm run release:zip`: passing, generated `release/lutrafin-0.2.58-docker.zip`.
- `npm run release:check-secrets`: passing.

## 2026-09-26 - Immediate Theme Switching Fix

### Fixed

- Theme switch actions now update the root `data-theme` and `data-theme-preference` attributes immediately after the POST succeeds, so switching between system, light and dark no longer requires a browser reload.

### Changed

- Bumped the app version to `0.2.57`.

### Verification

- `npm run check`: passing.
- `npm run lint`: passing.
- `npm test`: passing, 73 tests.
- `npm run build`: passing.
- `npm run release:zip`: passing, generated `release/lutrafin-0.2.57-docker.zip`.
- `npm run release:check-secrets`: passing.

## 2026-09-26 - External Entry Brand Intro

### Added

- Added a short one-time brand intro for external/direct page entries: the loaded page is darkened and blurred behind a centered sharp Lutrafin logo that zooms forward and clears immediately at the end.
- The intro is gated by `sessionStorage`, so it does not replay during internal SvelteKit navigation in the same tab.
- Users with `prefers-reduced-motion: reduce` skip the intro entirely.

### Changed

- Bumped the app version to `0.2.56`.

### Verification

- `npm run check`: passing.
- `npm run lint`: passing.
- `npm test`: passing, 73 tests.
- `npm run build`: passing.
- `npm run release:zip`: passing, generated `release/lutrafin-0.2.56-docker.zip`.
- `npm run release:check-secrets`: passing.

## 2026-09-26 - Delivery Scheduler And Release Hardening

### Added

- Added SQLite-backed TMDB season watch-provider caching with a 6h TTL so public detail pages do not fan out to TMDB on every request.
- Added a shared job coordinator for Jellyfin sync and metadata refresh; concurrent manual/API/scheduled starts now fail with `409 Already running` or a clear UI redirect message.
- Added release secret checks via `npm run release:check-secrets` and included release scripts in the generated source archive.
- Added hold-to-reveal controls for secret notification fields in Settings.

### Changed

- Notification provider requests now use a 10s timeout, reject redirects and validate notification URLs with `new URL()` while still allowing private HTTP/HTTPS HomeLab targets.
- Notification deliveries are claimed through `pending`/`failed` -> `sending` -> `sent`, final failures become `exhausted`, and due retries no longer pick exhausted rows.
- Login rate limiting now keys only on SvelteKit `getClientAddress()` and bounds the in-memory failed-attempt store with TTL cleanup and a maximum size.
- Admin sessions created before the current Node process start are now rejected, invalidating sessions on restart.
- Scheduler startup moved into the server init path, and scheduler success timestamps are updated only after successful jobs; failures retry with short exponential backoff instead of waiting for the full configured interval.
- Docker Compose now binds to `127.0.0.1` by default, has a `/health/ready` healthcheck and optional PID/memory limits.
- Release ZIPs no longer contain a generated `.env` or populated `secrets/*.txt`; only `.env.example` and `secrets/*.example` placeholders are shipped.
- Bumped the app version to `0.2.55`.

### Fixed

- A known season that previously had `airDate=null` and later receives a future date now emits one `season_announced` event while preserving event-key deduplication.
- An intentionally empty notification event selection now stays empty instead of falling back to all event types.
- External JSON responses now have a 2 MiB default read limit, and poster proxy responses are capped at 15 MiB.

### Verification

- `npm run check`: passing.
- `npm run lint`: passing.
- `npm test`: passing, 73 tests.
- `npm run build`: passing.
- `npm run release:zip`: passing, generated `release/lutrafin-0.2.55-docker.zip`.
- `npm run release:check-secrets`: passing.

## 2026-09-26 - Settings Notification Submit Target And Docker Rebrand

### Fixed

- The notification settings form posted to `/[object%20RadioNodeList]` instead of its own endpoint, so `Save notifications` and `Test notification` silently did nothing and Pushover could not be enabled. `HTMLFormElement` uses `[LegacyOverrideBuiltIns]`, so the submit buttons with `name="action"` shadowed the built-in `action` property; the submit handler now reads the endpoint via `form.getAttribute('action')`.
- Renamed the leftover `streamycheck` Docker system user and group to `lutrafin` in `Dockerfile`; uid/gid stay `10001` so existing volumes keep their ownership.

### Added

- Added `AGENTS.md` with the mandatory pre-commit checklist (version bump across `package.json`, `package-lock.json` and `src/lib/version.ts`, documentation and `DEVELOPMENT_LOG.md` updates, `npm run release:zip`, checks, commit style).

### Changed

- Bumped the app version to `0.2.54`.
- Verified the settings flow end to end in a real browser: save, test notification, provider reset and automation save all show dialog feedback and persist their state.

## 2026-09-26 - Lutrafin Rebrand And Settings Feedback

### Changed

- Completed the Lutrafin rebrand across visible UI, browser titles, package metadata, Docker release naming, notifications, docs and runtime prefixes.
- Settings notification and automation actions now keep the user on the page and show dialog-style success/status feedback after JSON saves, resets and test notifications.
- Settings select fields now use the same soft input styling as text fields.
- Bumped the app version to `0.2.53`.

## 2026-09-25 - Episode Check Details Reset And Notification Inputs

### Fixed

- Forced the Episode check card list to remount when opened collapsed from the menu or when using `Collapse all`, preventing native `<details>` state from staying open while the button shows `Expand all`.
- Refined notification provider input spacing and colors so fields blend into both light and dark themes instead of appearing as harsh full-width bars.
- Bumped the app version to `0.2.52`.

## 2026-09-25 - Episode Check Menu Collapse

### Fixed

- Opening Episode check from the navigation menu now explicitly starts with all series cards collapsed, regardless of previously persisted expansion state.
- Bumped the app version to `0.2.51`.

## 2026-09-25 - Library Sync Interval And Link Polish

### Changed

- Added a Settings-controlled Jellyfin library sync interval for the background scheduler.
- Reworked notification provider cards so controls and fields stack vertically instead of being squeezed horizontally.
- Moved About/Über to the end of the navigation menu.
- Opened legal/source/external links from the About page in a new tab.
- Bumped the app version to `0.2.50`.

## 2026-09-25 - Notification Settings Submit Fix

### Fixed

- Switched Settings notification and automation saves from browser form submissions to same-origin JSON requests so strict SvelteKit CSRF/origin checks do not reject deployments behind imperfect proxy headers.
- Kept admin-session authorization and safe redirect handling in place; CSRF protection was not disabled.
- Bumped the app version to `0.2.49`.

## 2026-09-25 - Episode Check Collapse And Notification Controls

### Fixed

- Fixed `Collapse all` on the Episode check page when series expansion state was persisted.
- Added per-provider reset actions for notification settings.
- Switched notification event and provider enabled controls to the same on/off switch styling used elsewhere in Settings.
- Bumped the app version to `0.2.48`.

## 2026-09-25 - Override Titles And Menu Brand Fix

### Fixed

- Manual episode overrides now show the external episode title when available.
- Restored compact logo/title alignment in the sidebar brand area while keeping the mobile close action right-aligned.
- Bumped the app version to `0.2.47`.

## 2026-09-25 - Episode Check And Mobile UI Polish

### Changed

- Preserved episode-check open state and scroll position during manual override actions.
- Refined episode-check card actions, manual override layout and small action rows.
- Reworked the mobile sidebar into a burger-triggered overlay menu.
- Improved Settings layout through the Notifications section.
- Bumped the app version to `0.2.46`.

## 2026-09-25 - Episode Overrides, Automation And Notifications

### Added

- Added manual episode presence overrides to the episode check with per-series reset controls.
- Added episode-check series actions for details, ignore and streaming-provider grouping.
- Added Settings-controlled metadata due-refresh and periodic full-refresh intervals.
- Added persistent notification events, baseline handling, deduplication, retryable deliveries and providers for ntfy, Gotify, Pushover and generic webhooks.
- Added database migration `0007_episode_overrides_notifications`.
- Bumped the app version to `0.2.45`.

## 2026-09-25 - Docker Release ZIP Script

### Added

- Added `npm run release:zip` to create `release/lutrafin-<version>-docker.zip`.
- The archive contains the Docker build context, Compose file, generated `.env`, placeholder secret files and release install notes for `docker compose up -d`.
- Bumped the app version to `0.2.44`.

## 2026-09-25 - Public Release Licensing Prep

### Added

- Added AGPL-3.0-only license metadata and the full `LICENSE` text.
- Added About/Legal page with version, license, source-code link and provider attribution.
- Added `SECURITY.md`, `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md` and `RELEASE_CHECKLIST.md`.
- Documented third-party service attribution and public-release release gates.

### Changed

- Added `SOURCE_CODE_URL` configuration for the public source link shown in-app.
- Bumped the app version to `0.2.43`.

## 2026-09-25 - Episode Check Ignore Filter

### Fixed

- Excluded ignored series from the episode check, matching overview and shopping-list behavior.
- Bumped the app version to `0.2.42`.

## 2026-09-25 - Episode Check UI Refinement

### Changed

- Reworked the episode check into collapsible series cards with posters, season groups and an expand/collapse-all control.
- Hid entirely missing seasons from the episode check so only partial episode gaps inside locally present seasons are shown.
- Switched sync and metadata status clear confirmations to the same modal pattern used by the shopping list.
- Bumped the app version to `0.2.41`.

## 2026-09-25 - Episode Check And Season Streaming

### Added

- Added the `Episode check` / `Episodencheck` sidebar page with `Find missing episodes` / `Fehlende Folgen finden` as page title.
- Stored local Jellyfin episodes and external TMDB episodes for missing-episode detection.
- Added database migration `0006_episodes`.

### Changed

- Streaming availability for missing seasons now uses TMDB season-level watch-provider endpoints instead of series-level availability.
- Bumped the app version to `0.2.40`.

## 2026-09-25 - Status Feedback And Optional Hardening

### Changed

- Status clear actions now ask for confirmation, redirect with a visible success message and force data invalidation after same-page redirects.
- Added opt-in HTTPS-only HSTS support via `SECURITY_HSTS_ENABLED`; it remains disabled by default for direct HTTP HomeLab deployments.
- Added a small login request body size guard and skipped overlapping scheduled job runs.
- Bumped the app version to `0.2.39`.

## 2026-09-25 - Admin Session Migration Fix

### Fixed

- Registered `0005_admin_sessions` in Drizzle's migration journal so updated deployments create the `admin_sessions` table before session checks run.
- Bumped the app version to `0.2.38`.

## 2026-09-25 - Admin Security Hardening

### Changed

- Replaced deterministic admin cookie contents with random server-side sessions stored by hash in SQLite.
- Converted mutating route endpoints from GET to POST and updated UI actions to issue explicit POST requests.
- Added failed-login rate limiting to `/login/session`.
- Hardened boolean environment parsing and backslash redirect rejection.
- Documented the intentional public read/admin-write access model.
- Bumped the app version to `0.2.37`.

## 2026-09-24 - Documentation Refresh

### Changed

- Updated README and architecture documentation to reflect current login, settings, streaming availability, overview grouping, shopping list and diagnostics behavior.
- Updated current development state and test count.
- Bumped the app version to `0.2.36`.

## 2026-09-24 - Streaming Grouped Overview

### Added

- Added an on/off toggle beside `Ergebnisse auf Einkaufsliste` for grouping `Neue Staffeln` by streaming provider.
- Replaces the normal new-season list with provider groups while enabled and restores the standard list when disabled.
- Reuses the same regional TMDB watch-provider matching rules as the series detail page.
- Bumped the app version to `0.2.35`.

## 2026-09-24 - Compact Settings Layout

### Changed

- Made the upper settings cards more compact with row-based options instead of nested cards.
- Grouped streaming settings into display options and services.
- Reduced repeated enabled/disabled labels where switches already communicate state.
- Restyled metadata providers as compact status rows with separate configured state and activation switch.
- Bumped the app version to `0.2.34`.

## 2026-09-24 - Technical Season Diagnostics

### Changed

- Moved season diagnostics into the collapsed technical details area on the series detail page.
- Automatically expands technical details when admin-only season diagnostics are enabled.
- Reduced the visual weight of diagnostic rows to match other technical metadata.
- Bumped the app version to `0.2.33`.

## 2026-09-24 - Streaming Availability Highlight

### Changed

- Colored available streaming provider names green in the series detail view, matching their availability status.
- Bumped the app version to `0.2.32`.

## 2026-09-24 - Series Detail Layout Refresh

### Changed

- Reworked the series detail view into a calmer hierarchy with a compact header, two-column main section and full-width streaming/shopping area.
- Combined shopping-list season actions into a single `Staffeln hinzufügen` dropdown while keeping ignore separate.
- Made local seasons compact and emphasized missing/upcoming seasons as exceptions.
- Moved freshness next to seasons and provider IDs into a collapsed technical details section with copy buttons.
- Changed streaming availability from pills to provider rows with subdued unavailable states.
- Bumped the app version to `0.2.31`.

## 2026-09-24 - JSON Admin Login

### Fixed

- Replaced the admin login form POST with a JSON login request to avoid SvelteKit cross-site form POST rejection behind forwarded-host deployments.
- Kept credentials out of URLs and retained server-side credential validation.
- Bumped the app version to `0.2.30`.

## 2026-09-24 - Explicit Admin Login Form

### Fixed

- Replaced the browser Basic Auth login link with explicit username and password fields.
- Removed the `/login/basic` endpoint so cached browser Basic Auth credentials can no longer bypass visible input fields.
- Bumped the app version to `0.2.29`.

## 2026-09-24 - Admin Credential Hardening

### Fixed

- Rejected empty or whitespace-only `ADMIN_USERNAME` values instead of allowing ambiguous admin credentials.
- Trimmed configured admin usernames before validation.
- Explicitly rejected empty Basic Auth username/password input.
- Added regression tests for admin credential configuration.
- Bumped the app version to `0.2.28`.

## 2026-09-24 - Streaming Display Settings

### Changed

- Added global Settings toggles for showing streaming availability and Amazon season links.
- Skipped TMDB watch-provider lookups when streaming availability is disabled.
- Tightened streaming provider matching to use TMDB provider IDs and exact aliases, preventing ARD Plus from being shown as ARD Mediathek.
- Bumped the app version to `0.2.27`.

## 2026-09-24 - Streaming Provider Toggles

### Changed

- Added Settings toggles for individual streaming providers.
- Changed the detail-page streaming section to show every enabled streaming provider with green available and red unavailable status.
- Moved the Amazon season link below the streaming provider information to avoid overlap.
- Bumped the app version to `0.2.26`.

## 2026-09-24 - Regional Streaming and Shopping Links

### Added

- Added a persisted Region/Land setting with selectable regions for Germany, Austria, Switzerland, the US and the UK.
- Added regional TMDB watch-provider lookup for detail pages when TMDB metadata is available.
- Added a new detail-page section for new seasons showing matching streaming services and a regional Amazon season search link.
- Bumped the app version to `0.2.25`.

## 2026-09-22 - CSRF Origin Configuration

### Fixed

- Removed hardcoded container `ORIGIN=http://localhost:3000`, which caused CSRF failures when the app was accessed via IP address or a real domain.
- Added `HOST_HEADER=x-forwarded-host` and `PROTOCOL_HEADER=x-forwarded-proto` to Compose so adapter-node can reconstruct the browser-facing origin behind a reverse proxy.
- Kept `ORIGIN` documented as an explicit fallback when forwarded headers are unavailable.
- Removed the Compose `ORIGIN` default again after runtime testing showed it can keep forcing `http://localhost:3000` when `APP_BASE_URL` is not exported in the shell running Compose.
- Removed default `HOST_HEADER` and `PROTOCOL_HEADER` from Compose because they break direct localhost/IP access when no reverse proxy sends matching forwarded headers.
- Added POST request origin diagnostics to server logs to debug remaining SvelteKit CSRF mismatches without exposing application secrets.
- Replaced manual form POST controls with JSON `fetch` endpoints for sync and metadata refresh so SvelteKit CSRF protection remains enabled while avoiding deployment-specific form-origin mismatches.
- Added no-JavaScript fallback run routes for manual sync and metadata refresh because deployed button clicks did not trigger client-side fetch requests in the reported runtime.
- Switched Docker Compose deployment configuration to read non-secret local values such as `JELLYFIN_URL`, app port and intervals from `.env`, while keeping tokens in Docker secret files.
- Switched Jellyfin library discovery from `/UserViews` to `/Library/MediaFolders` and changed the library override into `JELLYFIN_EXCLUDED_LIBRARY_IDS`, an exclusion list for automatically discovered TV libraries.
- Added in-sync deduplication for Jellyfin series with the same strong external IDs and replaced the JavaScript-only theme switcher with server-rendered cookie-based theme links.
- Added admin-only settings for Jellyfin library blacklist, ignored series and language selection, plus a sidebar version tag sourced from `src/lib/version.ts`.
- Moved the main navigation into the global layout so the left sidebar remains visible on every page, with content scrolling independently.
- Replaced Settings form POST mutations with admin-protected GET link actions to avoid SvelteKit form CSRF failures in direct/reverse-proxy deployments.
- Replaced the login form POST with a browser Basic Auth challenge endpoint at the time; this was later superseded by the explicit JSON admin login flow.
- Preserved Settings scroll position after link actions with section/item anchors and added overview-to-detail `returnTo` links so series detail back navigation returns to the originating filtered overview.
- Moved the cookie-based theme switcher into the sidebar footer for all users, converted it to compact icon controls, completed missing overview translations and made only real provider errors use the red metadata badge.
- Bumped the app version to `0.1.1` for logo, favicon, color palette and status-color UI polish; future changes must update the version according to impact.
- Added Metadata Status navigation/reporting from provider lookup history and moved provider status/toggles into Settings.
- Bumped the app version to `0.1.2` for completed Sync/Metadata Status translations, clear actions and external season source links.
- Bumped the app version to `0.1.3` for translated raw series/provider labels and clearer external source links on missing/upcoming seasons.
- Bumped the app version to `0.1.4` for storing the concrete metadata provider, using newest external states and adding forced metadata refresh.
- Bumped the app version to `0.1.5` for blue/violet sidebar gradient, glow and navigation polish in light and dark themes.
- Bumped the app version to `0.1.6` for clearer Library sync wording and grouped Metadata refresh actions in English and German.
- Bumped the app version to `0.1.7` for removing status-page start buttons and adding animated progress overlay for Library/Metadata runs.
- Bumped the app version to `0.1.8` for settings/status action cleanup and stronger clear/settings button styling.
- Bumped the app version to `0.1.9` for README updates covering current sync, metadata refresh, progress overlay and versioning behavior.
- Bumped the app version to `0.2.0` for the persistent Shopping List feature, bulk add actions, CSV export, print view and fixed progress overlay rendering.
- Bumped the app version to `0.2.1` for optional season diagnostics, improved shopping-list add/clear flows, priority reindexing and more reliable sync progress overlay display.
- Bumped the app version to `0.2.2` for server-rendered progress pending pages, conditional detail Shopping List panel, simplified season source links, consistent announced wording and local SVG sidebar icons.
- Bumped the app version to `0.2.3` for provider-aware gap detection, clearer overview shopping-list action placement, improved Settings grouping/switch controls and corrected sidebar icons.
- Bumped the app version to `0.2.4` for moving series-detail Shopping List actions into the top hero action area with compact overview-style grouping.
- Bumped the app version to `0.2.5` for fixing series-detail Shopping List add actions, making the add button primary, and replacing the clear confirmation page with an in-page overlay dialog.
- Bumped the app version to `0.2.6` for shopping-list add confirmation overlays and returning add-menu actions to the Shopping List page.
- Bumped the app version to `0.2.7` for lighter blurred overlays and explicit in-place theme switching redirects.
- Bumped the app version to `0.2.8` for full-width series status results and per-series new/announced season count indicators.
- Bumped the app version to `0.2.9` for one-click per-series local season number overrides suggested from Jellyfin display-name conflicts.
- Bumped the app version to `0.2.10` for live search filtering in Overview/Settings, exclusive language switches and refreshed i18n coverage.
- Bumped the app version to `0.2.11` for fixing 500 errors caused by server-side URL hash access in the global layout load.
- Bumped the app version to `0.2.12` for making Overview live search use SvelteKit navigation with a bound input value.
- Bumped the app version to `0.2.13` for locale-aware browser-timezone timestamp formatting on overview, sync, metadata and series detail pages.
- Bumped the app version to `0.2.14` for fixed German Berlin-time timestamp formatting and effect-driven live search updates.
- Bumped the app version to `0.2.15` for URL-backed live search on Overview/Settings, Settings GET fallback filtering and SvelteKit hydration CSP compatibility.
- Bumped the app version to `0.2.16` for search reset actions, compact Settings search controls and a scroll-aware content back-to-top button.
- Bumped the app version to `0.2.17` for excluding ignored series from shopping-list candidates and adding URL-backed live search to the add-to-shopping-list page.
- Bumped the app version to `0.2.18` for faster live search debounce and equal-height search reset buttons.
- Bumped the app version to `0.2.19` for unified button typography across button variants.
- Bumped the app version to `0.2.20` for resetting the content scroll position after sidebar menu navigation.
- Bumped the app version to `0.2.21` for clearer overview status-card labels and total new-season counts.
- Bumped the app version to `0.2.22` for keeping New Seasons badge/filter labels short while using a longer overview card label.
- Bumped the app version to `0.2.23` for simplifying the overview new-seasons card copy.
- Bumped the app version to `0.2.24` for renaming the sidebar subtitle to Jellyfin Season Tracker/Jellyfin-Staffeltracker.

### Decisions

- CSRF protection remains enabled. Deployments must set `ORIGIN` to the browser-facing URL.
- `npm audit --audit-level=high` passes after updating `drizzle-orm`; remaining audit items are moderate/low transitive dev/runtime advisories in SvelteKit cookie handling, Vitest mocker and Drizzle Kit/esbuild. Do not use `npm audit fix --force` blindly because suggested fixes are breaking/downgrade paths.

## 2026-09-22

### Added

- Created SvelteKit project scaffold with strict TypeScript configuration.
- Added server-only configuration validation with environment variables and Docker-secret-compatible `_FILE` support.
- Added global security headers in `hooks.server.ts`.
- Added SQLite/Drizzle schema and initial migration for media entities, local seasons, external IDs, provider state and sync runs.
- Added `/health/live` and `/health/ready` endpoints.
- Added once-per-process startup migration from the SvelteKit server hook.
- Added initial overview shell with responsive sidebar, KPI placeholders and design tokens.
- Added domain logic for TMDB/TVmaze status normalization.
- Added season comparison logic for regular seasons, future announced seasons, missing aired seasons and gaps.
- Added external-ID priority selection for matching.
- Added unit tests for status normalization, season 0 exclusion, season comparison edge cases and provider-ID priority.

### Decisions

- Started with Phase 1 because the repository was empty except for an empty `README.md`.
- Chose SvelteKit adapter-node for a compact single-container deployment target.
- Chose SQLite plus Drizzle as a typed, lightweight persistence layer.
- Updated `drizzle-orm` to a patched version after audit reported a high-severity advisory for older versions.
- Stored `MediaEntity` separately from series-specific rows so future media types are not blocked, while implementing only series now.
- Kept provider-specific status mapping in provider/domain-adjacent functions rather than UI components.
- Treat undated external seasons defensively: they count as known, not aired.
- Season 0 and invalid season numbers are retained in data but excluded from regular season comparisons.

### Discovered

- No prior implementation existed in the repository.

### Problems

- None currently blocking.

### Next

- Implement Jellyfin read-only adapter and reconciliation use case.
- Keep dependency audit under review; current high-severity audit gate passes.

## 2026-09-22 - Phase 2

### Added

- Implemented `JellyfinMediaSource` port with explicit read-only methods.
- Implemented `HttpJellyfinMediaSource` using only fixed GET requests to `/System/Info`, `/Library/MediaFolders`, `/Items`, and `/Shows/{seriesId}/Seasons`.
- Added bounded HTTP JSON helper with timeout, redirect blocking, limited retries and `Retry-After` handling.
- Added response validation for Jellyfin data with Zod.
- Added `SyncJellyfinLibrary` use case with single-process duplicate-sync prevention.
- Added SQLite reconciliation repository that upserts series/seasons and marks missing records removed only after a full successful scan.
- Added manual `Sync Now` form action.
- Added integration tests for the Jellyfin adapter with a local mock HTTP server.
- Added reconciliation tests for initial sync, failed sync preserving data, successful removal and newly added seasons.
- Added `local_season_external_ids` table via migration `0001_local_season_external_ids` because seasons are not `MediaEntity` rows.

### Decisions

- Jellyfin sync remains server-only; browser requests never receive Jellyfin credentials.
- No generic Jellyfin HTTP method or proxy was introduced.
- Sync deletes/deactivates nothing until all series and seasons have been loaded successfully.
- Season provider IDs are stored separately from `media_external_ids` to preserve foreign-key integrity.
- The current adapter follows the Jellyfin OpenAPI stable spec observed as `12.1.0` during development.

### Discovered

- `/Shows/{seriesId}/Seasons` supports the required season fields with optional `ProviderIds` and image fields.
- `/Items` can query `includeItemTypes=Series` under a parent library.
- `/Library/MediaFolders` can discover `tvshows` libraries without a Jellyfin user-specific views endpoint.

### Problems

- No real Jellyfin instance has been used yet; current coverage is mockserver-based.
- Add poster proxy and then TMDB metadata provider.

## 2026-09-22 - Local Overview

### Added

- Implemented `GetSeriesOverview` use case and `SeriesOverviewDTO`.
- Added SQLite overview repository reading active local series and local seasons from the sync snapshot.
- Replaced static KPI placeholders with real local snapshot counts.
- Added initial server-rendered series list with local regular seasons and metadata health status.
- Added empty state for installations before the first successful sync.

### Decisions

- The browser receives a prepared overview DTO; season/status aggregation remains server-side.
- External season/status fields remain unknown until provider integration exists instead of fabricating data.

### Problems

- Poster URLs are placeholders until the controlled Jellyfin image proxy is implemented.
- Filters/search/sort are still not implemented.

### Next

- Implement restricted poster proxy for known Jellyfin item IDs.
- Add Overview filters/search/sort.

## 2026-09-22 - Poster Proxy

### Added

- Added `/poster/[itemId]` endpoint for Jellyfin primary images.
- Added DB lookup that allows poster fetches only for active, known local series `jellyfinItemId` values.
- Updated overview list to render proxied poster images lazily while keeping Jellyfin tokens server-side.

### Decisions

- The poster endpoint does not accept arbitrary URLs and is not a generic Jellyfin proxy.
- Upstream Jellyfin redirects are rejected and only common image content types are returned.
- Posters are cached privately for one hour by the browser/proxy layer.

### Problems

- No dedicated poster endpoint test exists yet; current verification is typecheck/build based.

### Next

- Add filters/search/sort.
- Start TMDB provider integration.

## 2026-09-22 - Overview Filtering

### Added

- Added server-side overview query model with `filter`, `q`, and `sort` URL parameters.
- Added filter counts for All, Continuing, Ended, New Season, Announced, Gaps and Metadata Issues.
- Added local search over name, original title and production year.
- Added sort options for name, last checked, status and missing seasons.
- Added UI filter chips, search field and sort select above the series list.

### Decisions

- Filtering/search/sorting run server-side against the local SQLite projection rather than calling Jellyfin or providers per interaction.
- Query state is encoded in the URL for bookmarkable views.

### Problems

- Continuing/Ended filters will remain empty until external metadata status is implemented.

### Next

- Implement TMDB provider adapter and metadata matching.

## 2026-09-22 - TMDB Metadata

### Added

- Added generic `SeriesMetadataProvider` port.
- Implemented TMDB TV provider using Bearer token auth and fixed endpoints `/3/tv/{id}`, `/3/search/tv`, and `/3/authentication`.
- Added direct TMDB-ID matching before any text search.
- Added conservative name/year search fallback that remains unresolved on ambiguity.
- Added metadata refresh use case for due series.
- Persisted normalized external series state and external seasons.
- Connected overview status and season comparison to stored external metadata.
- Added manual `Refresh Metadata` action.
- Added TMDB mockserver tests for direct ID matching, ambiguous search and unauthorized responses.

### Decisions

- TMDB details response is used for seasons to minimize API calls.
- Provider errors update local metadata error state but do not delete previously stored external state/seasons.
- Continuing/upcoming shows refresh daily; ended/canceled/unknown refresh weekly; unresolved/error retry after six hours.

### Discovered

- TMDB TV details includes seasons with `season_number`, `air_date`, and `episode_count`, sufficient for MVP season-level comparison.

### Problems

- TVmaze fallback is still missing.
- Metadata refresh can run manually and on the in-process scheduler.

### Next

- Add TVmaze fallback provider.
- Add scheduled background jobs.

## 2026-09-22 - Scheduled Jobs

### Added

- Added in-process scheduler started after migrations are applied.
- Added startup and interval Jellyfin sync when Jellyfin is configured.
- Added startup and interval metadata refresh when TMDB is configured.
- Added duration parsing for `SYNC_INTERVAL` and `METADATA_REFRESH_INTERVAL`.
- Added structured warning logs for job failures without crashing the app.

### Decisions

- Background jobs are skipped when the required external configuration is absent.
- External provider/Jellyfin failures are logged but do not make the app unusable with cached data.
- Timers use `unref()` so they do not keep a process alive during shutdown.

### Problems

- Scheduler is in-process only; this matches MVP but multiple app replicas would each run jobs.

### Next

- Add TVmaze fallback provider.
- Add Docker packaging and deployment docs.

## 2026-09-22 - Deployment

### Added

- Added multi-stage Dockerfile using Node 22 bookworm slim.
- Added non-root runtime user and `/data` volume for SQLite.
- Added Docker Compose reference with Docker secrets, `no-new-privileges`, dropped capabilities, readonly root filesystem and `/tmp` tmpfs.
- Added `.dockerignore`.
- Added CI workflow for lockfile install, lint, typecheck, tests, build and high-severity audit gate.
- Updated README with Docker Compose, backup and update guidance.

### Decisions

- Runtime image keeps migration files at the same relative path expected by the existing migration runner.
- No Jellyfin media directories or Jellyfin database paths are mounted.

### Problems

- Docker CLI is installed, but the Docker daemon was not reachable at `unix:///Users/richard/.docker/run/docker.sock`, so the image build could not be verified locally.

### Next

- Run Docker build if local Docker is available.
- Add TVmaze fallback provider.

## 2026-09-22 - Theme Support

### Added

- Added Light/Dark/System theme switcher in the top bar.
- Added theme persistence via the application theme cookie.
- Added early theme bootstrap script in `app.html` to avoid visible wrong-theme flash.
- Added explicit dark tokens via `:root[data-theme='dark']` while keeping centralized design tokens.
- Added CSP SHA-256 hash for the static bootstrap script instead of allowing arbitrary inline scripts.

### Decisions

- Theme state remains local UI state and is not stored in the server database.
- System theme resolves through `prefers-color-scheme` on initial load and when selected.

### Problems

- Theme switcher is currently only on the overview page because the app shell is still page-local.

### Next

- Move AppShell/TopBar into reusable components when detail pages are introduced.

## 2026-09-22 - TVmaze Fallback

### Added

- Added TVmaze provider implementing the shared `SeriesMetadataProvider` port.
- Added TVDB and IMDb cross-provider lookup support via TVmaze `/lookup/shows`.
- Added conservative TVmaze name/year search fallback.
- Added TVmaze seasons ingestion from `/shows/{id}/seasons`.
- Added composite provider that tries TMDB first and TVmaze afterwards.
- Added TVmaze mockserver tests for cross-provider ID lookup, ambiguous search and HTTP 429 handling.

### Decisions

- TVmaze remains optional via `TVMAZE_ENABLED`; it needs no API token.
- Metadata scheduler runs if either TMDB or TVmaze is configured.
- Ambiguous TVmaze search results remain unresolved.

### Problems

- TVmaze attribution still needs final README polish.

### Next

- Implement series detail page.

## 2026-09-22 - Series Detail Page

### Added

- Added `/series/[id]` detail route.
- Added `GetSeriesDetails` use case and SQLite repository.
- Added local/external season merge with `local`, `missing`, and `upcoming` season labels.
- Added provider IDs, metadata freshness, Jellyfin sync time and provider error display.
- Linked overview series rows to detail pages.
- Added responsive detail layout.

### Decisions

- Detail page remains scoped to status/control information only: no cast, reviews, trailers, recommendations or playback.
- Season 0 remains separated as Specials count and is not merged into regular season progression.

### Problems

- No dedicated detail repository unit test yet.

### Next

- Documentation polish and final verification pass.

## 2026-09-22 - Operational Pages

### Added

- Added `/sync` page with recent sync runs and manual sync action.
- Added `/providers` page showing configured metadata providers without exposing secrets.
- Added `/settings` page documenting deployment-driven settings and local theme preference.
- Updated sidebar links to real pages.

### Decisions

- Settings UI remains intentionally minimal; secrets stay deployment-managed.
- Sync logs remain summary rows in the UI; detailed logs stay in stdout/stderr.

### Problems

- Docker daemon remains unavailable for local image build verification.

### Next

- Final docs/checks and commit.
