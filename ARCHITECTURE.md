# Architecture

## System Context

Lutrafin is a small selfhosted SvelteKit application that monitors TV series stored in Jellyfin. Jellyfin is treated as a read-only media source through its HTTP API. External metadata providers are server-side adapters and are never called from browser JavaScript.

## Modules

- `src/lib/server/domain`: framework-independent domain types and rules.
- `src/lib/server/config`: environment and secret-file configuration validation.
- `src/lib/server/infrastructure/database`: SQLite/Drizzle schema, connection setup and migrations.
- `src/lib/server/infrastructure/jellyfin`: read-only Jellyfin HTTP adapter.
- `src/lib/server/application/use-cases`: orchestration use cases such as Jellyfin library sync, metadata refresh and overview/detail DTO assembly.
- `src/lib/server/streaming`: shared server-side streaming availability matching for detail and overview pages.
- `src/routes`: SvelteKit web layer, admin action endpoints and health endpoints.
- `tests`: unit and adapter tests for domain rules, providers, Jellyfin sync and auth configuration.

## Dependency Direction

Domain code does not import SvelteKit, Jellyfin, TMDB, TVmaze, SQLite or Drizzle. Infrastructure implements persistence and provider/media-source ports. Routes call application services, shared server utilities or infrastructure health checks and should keep business rules out of browser-facing components.

## Data Model

The database is a normalized projection and status store, not a Jellyfin clone.

- `media_entities` stores common media identity. MVP supports `series` only.
- `local_series` stores series-specific metadata refresh state.
- `local_seasons` stores locally known Jellyfin seasons, including season 0 and non-regular values.
- `media_external_ids` stores provider IDs generically with a source marker.
- `local_season_external_ids` stores season-level provider IDs separately because seasons are not `MediaEntity` rows.
- `external_series_states` and `external_seasons` store normalized provider metadata.
- `provider_lookups` records matching attempts and refresh scheduling.
- `sync_runs` records Jellyfin and metadata sync attempts.
- `app_settings` stores non-secret UI and provider settings such as language, region, diagnostics and streaming toggles.
- `ignored_series` stores locally ignored series.
- `shopping_list_items` stores the persistent shopping list.
- `local_season_number_overrides` stores per-series corrections for Jellyfin season numbers that conflict with display names.
- `notification_events` and `notification_deliveries` store deduplicated notification events and retryable delivery state.
- `tmdb_watch_provider_cache` stores season watch-provider responses per TMDB series/season/region with a TTL.

## Sync Strategy

The intended Jellyfin sync is full reconciliation:

1. Start a `sync_runs` record.
2. Read current series through a `JellyfinMediaSource` adapter.
3. Upsert series and seasons.
4. Update `lastSeenInJellyfinAt`.
5. Only after a complete successful scan, mark missing records removed.
6. Complete the sync run.

If the scan fails midway, existing local records must not be deleted or deactivated.

The implemented `SyncJellyfinLibrary` use case follows this model. It reads server info first, then the complete series list, then all seasons. Only after all remote reads finish does the repository transaction upsert and mark removed records.

Sync and metadata refresh can run manually through admin-only run endpoints with pending/progress pages and automatically through an in-process scheduler. Jobs start only after migrations have run at server init. Jellyfin sync and metadata refresh share a process-wide coordinator lock, so concurrent manual/API/scheduled starts fail predictably instead of duplicating work. Missing Jellyfin/TMDB configuration skips the respective job rather than failing application startup.

## Jellyfin Adapter

`HttpJellyfinMediaSource` implements the read-only media source port. It exposes only:

- `getServerInfo()`
- `getLibraries()`
- `getSeries()`
- `getSeasons()`
- `getPrimaryImageUrl()`

The adapter uses fixed GET requests and does not expose a generic HTTP method. Redirects are rejected, request timeouts are enforced and responses are schema-validated before entering application logic.

## Poster Proxy

Browser-facing poster URLs use `/poster/[itemId]`. The endpoint first checks the local database for an active known series with that Jellyfin item ID and only then fetches `/Items/{itemId}/Images/Primary` from the configured Jellyfin base URL. Jellyfin credentials stay server-side and arbitrary proxy URLs are not supported.

## Provider Strategy

Provider adapters implement a common `SeriesMetadataProvider` shape. Matching priority is TMDB ID, TVDB ID, IMDb ID, cross-provider lookup, then conservative name/year matching. Ambiguous name search results remain unresolved.

TMDB is implemented as the primary provider. If a Jellyfin TMDB external ID exists, the TMDB adapter calls `/3/tv/{id}` directly and does not perform text search. Name/year search is only used as a conservative fallback and unresolved ambiguity is stored rather than guessed. TVmaze is implemented as a fallback provider using TVDB/IMDb lookup first, then conservative name/year search.

TMDB watch-provider data is used server-side for optional regional streaming availability. Missing-season status uses TMDB season-level watch-provider endpoints so availability is tied to the concrete season. Results are cached in SQLite per series/season/region with a TTL to avoid repeated public-page fanouts. The same `src/lib/server/streaming/availability.ts` matching logic powers series detail pages and the grouped `New Seasons` overview. Matching prefers TMDB provider IDs and only falls back to exact aliases for services without reliable IDs in the configured set.

The episode check stores local Jellyfin episodes and TMDB external episodes separately. The `/episode-check` page compares already aired external episodes with active local Jellyfin episodes, ignores specials and applies local season-number overrides before deciding that an episode is missing. It only reports gaps for seasons that have at least one local episode, avoiding duplicate reporting for entirely missing seasons.

## Security Decisions

- Secrets are server-only and can be loaded from Docker-secret-compatible file paths.
- Browser URLs never contain Jellyfin or provider credentials.
- Poster images are proxied only for known local series IDs.
- Health endpoints return only coarse status and no stack traces.
- Security headers are set globally in `hooks.server.ts`.
- HSTS is opt-in and HTTPS-gated so the default deployment remains compatible with direct HTTP HomeLab access.
- SQLite access goes through Drizzle and parameterized statements.
- Foreign keys are enabled on every SQLite connection.
- Public overview, detail, provider, poster and export read paths are intentionally readable without admin login for self-hosted household dashboards.
- Admin login uses explicit username/password fields and a JSON session endpoint with failed-login rate limiting.
- Admin sessions use random cookie values; only their hashes are stored server-side and logout invalidates the current session.
- Admin sessions created before the current Node process start are rejected, so a restart invalidates existing admin sessions.
- Manual sync, metadata refresh, theme and settings mutations use admin-only POST endpoints; framework CSRF protections are left enabled.
- Scheduled background jobs skip overlapping runs for the same job name.
- Provider tokens never leave the server.
- Notification URLs are parsed with `new URL()` and restricted to HTTP/HTTPS; private HomeLab destinations remain valid.
- Notification HTTP requests reject redirects and time out after 10 seconds. Retryable failures are limited to timeout/network errors, HTTP 408, HTTP 429 and HTTP 5xx; permanent 4xx/configuration/provider validation errors are exhausted without retry.
- Notification delivery is at-least-once across process crashes because a provider may accept a request before Lutrafin records the delivery as sent. Sending claims use a short lease so stale in-flight rows can be retried.
- Notification secrets may be supplied through environment variables or `_FILE` paths and are merged server-side with UI settings without being returned to browser clients.
- External JSON reads and poster proxy responses enforce response-size limits.

## Technical Decisions

- SvelteKit with adapter-node keeps deployment simple and selfcontained.
- SQLite is sufficient for a single-node selfhosted status monitor.
- Drizzle provides typed schema definitions without a heavy ORM layer.
- Domain tests start before provider integrations to lock down edge cases such as season 0 and undated provider seasons.
- Docker runtime is a single non-root Node process with SQLite stored under `/data`.
- Browser-facing assets are local/selfhosted; navigation icons are inline SVGs and no CDN assets are required.
