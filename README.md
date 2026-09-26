# Lutrafin

Lutrafin  
Copyright © 2026 Richard Becker  
Licensed under the GNU Affero General Public License v3.0 only.

Lutrafin is a small selfhosted Jellyfin season tracker. It reads series and season information from Jellyfin, stores a local SQLite projection, compares it with external metadata providers and helps track missing or announced seasons.

Jellyfin is strictly read-only. The application does not download media, trigger library scans, modify Jellyfin metadata, or proxy arbitrary Jellyfin requests.

## Current Status

Core application features are implemented:

- SvelteKit/TypeScript scaffold.
- Server-side configuration validation.
- SQLite/Drizzle schema and initial migration.
- Health endpoints.
- Responsive UI shell with overview, series detail, status, shopping list and settings pages.
- Domain tests for status normalization, ID matching and season comparison.
- Startup migrations are applied once per server process.

Library sync is implemented:

- Read-only Jellyfin HTTP adapter.
- Full series/season reconciliation use case.
- Manual `Sync Library` / `Library synchronisieren` action with an animated in-page progress overlay.
- Integration tests with a mock Jellyfin server.
- Fail-safe sync behavior: failed scans do not mark existing records removed.

Metadata, shopping and streaming integration is implemented for the current provider set:

- Direct TMDB-ID matching.
- Conservative name/year fallback.
- TVmaze fallback via TVDB/IMDb IDs.
- Stored external status and seasons.
- Manual due-only and forced full metadata refresh actions, grouped under `Metadata` / `Metadaten` with the same progress overlay.
- Overview status/season comparison uses stored external metadata.
- Detail pages show compact local/external season state, freshness information, streaming availability, regional Amazon season search links and collapsed technical metadata.
- In-process scheduled Jellyfin sync and metadata refresh when configured.
- Sync Status and Metadata Status expose recent run/lookup history and admin-only clear actions.
- A persistent Shopping List can collect missing or announced seasons from filtered overview results, series detail pages or the Shopping List page itself. Items can be reordered, removed, printed in a reduced light print view and exported as CSV.
- The `New Seasons` / `Neue Staffeln` overview can be toggled between the normal list and a streaming-provider grouped view.
- Admins can enable Season Diagnostics in Settings. When enabled, local-vs-provider diagnostics are shown inside the collapsed `Technical details` section on series detail pages and can suggest per-series season number corrections.
- Settings include language, region/country, automation intervals, notifications, season diagnostics, streaming display switches, individual streaming provider toggles, metadata provider toggles, library blacklist and ignored series.
- Notifications can summarize newly announced or released seasons through ntfy, Gotify, Pushover or a generic JSON webhook. Events are persisted and deduplicated so the same season event is only sent once.

Docker runtime verification is still environment-dependent and could not be completed locally without a running Docker daemon.

## Requirements

- Node.js 22 or newer.
- npm.

## Development

```sh
npm install
npm run db:migrate
npm run check
npm test
npm run build
npm run dev
```

`npm run db:migrate` is useful for explicit local setup checks. The server also applies migrations during startup before serving requests.

## Docker Compose Installation

For a self-contained Docker release archive, run:

```sh
npm run release:zip
```

The archive is written to `release/lutrafin-<version>-docker.zip` and contains the Docker build context, `docker-compose.yml`, `.env` template and placeholder secret files needed for `docker compose up -d`.

Copy the example configuration and set your local values:

```sh
cp .env.example .env
```

At minimum, set `JELLYFIN_URL` in `.env` to the LAN URL or DNS name that is reachable from the Lutrafin container. Do not use `localhost` unless Jellyfin runs in the same container.

Create secret files outside version control:

```sh
mkdir -p secrets
printf 'your-jellyfin-token' > secrets/jellyfin_token.txt
printf 'your-tmdb-token' > secrets/tmdb_api_token.txt
printf 'your-admin-password' > secrets/admin_password.txt
docker compose up --build -d
```

The container runs as a non-root user and only needs the `/data` volume writable. It does not mount Jellyfin media folders or the Jellyfin database.

For hardened deployments, keep `no-new-privileges`, dropped capabilities and `read_only: true` from the provided `docker-compose.yml`.

## Configuration

Configuration is read from environment variables. Docker Compose automatically loads `.env` from the project directory. Secrets should be provided through Docker-secret-compatible files in `secrets/`.

Example `.env` for direct local testing:

```env
APP_BASE_URL=http://localhost:3000
APP_PORT=3000
DATABASE_PATH=/data/app.db
JELLYFIN_URL=http://192.168.178.20:8096
JELLYFIN_EXCLUDED_LIBRARY_IDS=
TVMAZE_ENABLED=true
TVDB_ENABLED=false
SYNC_INTERVAL=6h
METADATA_REFRESH_INTERVAL=24h
LOG_LEVEL=info
ADMIN_USERNAME=admin
ADMIN_PASSWORD_FILE=/run/secrets/admin_password
```

Keep these tokens out of `.env`; place them in files instead:

```text
secrets/jellyfin_token.txt
secrets/tmdb_api_token.txt
secrets/admin_password.txt
```

| Variable                                 | Required      | Default                 | Description                                                                                                                  |
| ---------------------------------------- | ------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `APP_BASE_URL`                           | no            | `http://localhost:3000` | Public app base URL.                                                                                                         |
| `SOURCE_CODE_URL`                        | no            | GitHub repository       | Public source repository URL shown on the About/Legal page.                                                                  |
| `ORIGIN`                                 | reverse proxy | unset                   | Optional SvelteKit trusted origin for CSRF-protected form actions. Set only if proxy headers cannot be forwarded correctly.  |
| `HOST_HEADER`                            | reverse proxy | unset                   | Optional adapter-node header for reverse proxy deployments, e.g. `x-forwarded-host`. Do not set for direct access.           |
| `PROTOCOL_HEADER`                        | reverse proxy | unset                   | Optional adapter-node header for reverse proxy deployments, e.g. `x-forwarded-proto`. Do not set for direct access.          |
| `APP_PORT`                               | no            | `3000`                  | Runtime port for adapter-node deployments.                                                                                   |
| `DATABASE_PATH`                          | no            | `./data/app.db`         | SQLite database path.                                                                                                        |
| `JELLYFIN_URL`                           | sync          | unset                   | Jellyfin base URL.                                                                                                           |
| `JELLYFIN_TOKEN` / `JELLYFIN_TOKEN_FILE` | sync          | unset                   | Read-only Jellyfin credential. Compose reads this from `secrets/jellyfin_token.txt`.                                         |
| `JELLYFIN_EXCLUDED_LIBRARY_IDS`          | no            | unset                   | Optional comma-separated Jellyfin TV library IDs to exclude from automatic discovery.                                        |
| `TMDB_API_TOKEN` / `TMDB_API_TOKEN_FILE` | metadata      | unset                   | Server-side TMDB token. Compose reads this from `secrets/tmdb_api_token.txt`.                                                |
| `TVMAZE_ENABLED`                         | no            | `true`                  | Enable TVmaze fallback provider.                                                                                             |
| `TVDB_ENABLED`                           | no            | `false`                 | TheTVDB is architecture-ready but not MVP-required.                                                                          |
| `SYNC_INTERVAL`                          | no            | `6h`                    | Jellyfin sync interval for the in-process scheduler.                                                                         |
| `METADATA_REFRESH_INTERVAL`              | no            | `24h`                   | Metadata refresh interval for the in-process scheduler.                                                                      |
| `LOG_LEVEL`                              | no            | `info`                  | Structured logging level.                                                                                                    |
| `SECURITY_HSTS_ENABLED`                  | no            | `false`                 | Enables the Strict-Transport-Security header only when `APP_BASE_URL` uses HTTPS. Keep disabled for direct HTTP HomeLab use. |
| `ADMIN_USERNAME`                         | admin         | unset                   | Username allowed to run manual sync, metadata refresh and settings mutations.                                                |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_FILE` | admin         | unset                   | Admin password. Compose reads this from `secrets/admin_password.txt`.                                                        |

The sidebar shows the app version tag from `src/lib/version.ts` so deployed builds can be identified in the UI.

Admin-only settings are available after login. Login uses explicit username/password fields and a JSON session endpoint with basic failed-login rate limiting, then stores a random admin session ID in an HTTP-only cookie while persisting only the session hash server-side. Empty or whitespace-only admin usernames are rejected at configuration load time, and empty login input is rejected server-side. Sync, metadata refresh, theme changes, library blacklist changes, provider enable/disable switches, streaming settings, ignored-series changes, region and language settings require that session. Mutating UI actions use explicit POST requests so crawlers and previews cannot trigger state changes via GET links.

Admin actions on the overview use explicit labels: `Sync Library` / `Library synchronisieren`, `Refresh Due` / `Fällige aktualisieren`, and `Refresh All` / `Alle aktualisieren`. `Refresh Due` respects the stored next-check timestamp. `Refresh All` intentionally rechecks all known series up to the server-side limit and is useful after provider fixes or metadata configuration changes. These actions first load server-rendered pending pages with an animated indeterminate progress overlay, then navigate to the long-running server action so users see that work is happening. Settings can also control the automatic Jellyfin library sync interval, the automatic due-refresh interval and an additional periodic full-refresh interval.

The Shopping List is available from the sidebar. The `New Seasons` / `Neue Staffeln` and `Announced` / `Angekündigt` overview filters expose an admin action to add all currently shown seasons. The `New Seasons` overview also exposes a toggle to replace the normal list with streaming-provider groups when TMDB season watch-provider data is available. Series detail pages combine aired/announced shopping-list actions into a `Staffeln hinzufügen` dropdown. The Shopping List page has one `+` entry point with bulk actions for all new/all announced seasons plus individual candidate rows, then supports reorder, remove, clear-with-confirmation, print and CSV export.

The sidebar entry `Episode check` / `Episodencheck` opens a dedicated page for finding missing episodes. It compares aired TMDB episodes with the current Jellyfin episode snapshot, ignores ignored series and specials/season 0, respects local season-number overrides and only reports episodes with an air date up to today. Completely missing seasons are intentionally hidden there because they are already covered by the missing-season overview; the episode check focuses on partial gaps inside locally present seasons. Admins can mark individual missing episodes as present for merged Jellyfin files, reset those manual overrides per series, open the series detail page or ignore the series directly from the episode check. The page can group affected series by season-level streaming availability.

Streaming availability uses TMDB watch-provider data for the configured region/country and the enabled provider list in Settings. Availability is fetched server-side on demand for series detail pages and for the grouped `New Seasons` overview. Missing-season rows and streaming grouping use TMDB season-level watch-provider data, so availability reflects the concrete season instead of only the series as a whole. The provider matching uses TMDB provider IDs and exact aliases so similarly named services such as ARD Plus are not shown as ARD Mediathek unless they explicitly match the configured service.

Season diagnostics can suggest one-click per-series corrections when Jellyfin reports a local season number that conflicts with the display name, for example `Staffel 1` stored as season `0`. Accepted corrections are persisted and applied to overview status, detail pages and Shopping List candidates while keeping the raw Jellyfin value visible in diagnostics.

The app is self-hosting friendly: navigation icons are inline local SVGs and no browser-facing assets are loaded from third-party CDNs.

Provider status and provider enable/disable controls live in Settings. Tokens remain secret-file based for metadata providers; notification tokens are stored server-side and never returned to the browser. Non-secret provider switches, streaming display options, individual streaming services, region/country, language, diagnostics, automation intervals, notifications, library blacklist and ignored series can be changed from the UI.

Notification providers are configured in Settings. The first successful metadata refresh for a series/provider establishes a notification baseline and does not emit historical events. Later metadata changes create persistent `season_announced` and `season_released` events, enqueue one summary notification per metadata refresh run and retry failed deliveries with bounded backoff. Provider failures are stored for retry and do not fail Jellyfin or metadata sync work.

Settings actions preserve the current Settings section via URL anchors. Series detail links include a return target so the Back to Overview link returns to the originating filtered/sorted overview state.

## Health Endpoints

- `/health/live`: process liveness only.
- `/health/ready`: checks internal readiness, currently SQLite availability.

## Jellyfin Configuration

Use a dedicated Jellyfin credential with the narrowest practical library access. Lutrafin only uses read-only HTTP API calls and never mounts Jellyfin data or media directories.

Lutrafin discovers Jellyfin TV show libraries automatically through `/Library/MediaFolders`. Configure `JELLYFIN_EXCLUDED_LIBRARY_IDS` only if specific TV libraries should be ignored.

## TMDB And TVmaze

TMDB is the primary metadata provider when `TMDB_API_TOKEN` is configured. Existing Jellyfin TMDB IDs are used directly before any text search.

TVmaze can be enabled as a fallback with `TVMAZE_ENABLED=true`. It is especially useful when Jellyfin has TVDB or IMDb IDs but no TMDB ID.

## Troubleshooting

- `Cross-site POST form submissions are forbidden`: current admin login and long-running admin actions avoid browser form POSTs. If this still appears for custom deployments or older builds, remove stale `ORIGIN`, `HOST_HEADER` and `PROTOCOL_HEADER` settings and recreate the container. For direct `http://localhost:3000` or `http://IP:3000` access, these values are usually not needed. Behind a reverse proxy, either set `ORIGIN` to the exact browser URL or configure `HOST_HEADER=x-forwarded-host` and `PROTOCOL_HEADER=x-forwarded-proto` while ensuring the proxy actually sends those headers.
- `No series found`: verify `JELLYFIN_URL`, token validity and optional `JELLYFIN_EXCLUDED_LIBRARY_IDS`, then run `Sync Library` / `Library synchronisieren`.
- `Metadata unresolved`: Jellyfin likely has no usable external IDs and provider search was ambiguous. The app intentionally does not guess.
- Missing/upcoming season links are absent: run `Refresh All` / `Alle aktualisieren` after confirming the TMDB token or TVmaze fallback is configured. Links only appear when the provider resolved the series and returned season data.
- Streaming availability or streaming grouping is absent: confirm `TMDB_API_TOKEN` is configured, streaming info is enabled in Settings, the correct region/country is selected and at least one streaming provider is enabled.
- `Provider error`: check TMDB token validity, provider availability and rate limits. Cached data remains visible.
- `Poster not found`: posters are only proxied for active known Jellyfin series with a primary image tag.
- Docker image build not verified locally: ensure the Docker daemon is running, then run `docker build -t lutrafin:test .`.

## Security Considerations

- API tokens must stay server-side.
- Do not expose Jellyfin tokens in browser URLs.
- The app intentionally has no generic Jellyfin proxy.
- Jellyfin sync uses fixed read-only adapter methods only.
- TMDB API tokens are only used server-side.
- SQLite foreign keys are enabled.
- Security headers are set globally.
- HSTS is intentionally opt-in via `SECURITY_HSTS_ENABLED=true` and is only emitted when `APP_BASE_URL` uses HTTPS, so direct HTTP HomeLab deployments remain supported by default.
- Public overview, detail, provider, poster and export read paths are intentionally readable without admin login for self-hosted household dashboards; all state-changing actions require the admin session.
- Admin sessions are random, server-side tracked and invalidated on logout.
- Mutating endpoints use POST; framework CSRF protections remain enabled.
- Health responses do not include secrets or stack traces.
- Provider and Jellyfin failures should be diagnosed through structured stdout/stderr logs, not browser-visible stack traces.

## Source Code

The canonical public source repository is:

```text
https://github.com/bigshit11elf/lutrafin
```

Set `SOURCE_CODE_URL` only if your deployment should point to a different public repository.

## Third-party Services

Lutrafin integrates with independent third-party projects and services, including Jellyfin, TMDB, TVmaze and optionally TVDB. These services are not part of Lutrafin and retain their own terms, trademarks, attribution rules and API policies.

### TMDB Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

### TVmaze Attribution

TV metadata provided in part by [TVmaze](https://www.tvmaze.com/).

See `THIRD_PARTY_NOTICES.md` for runtime dependency and attribution notes.

## License

Lutrafin is licensed under the GNU Affero General Public License Version 3 only (`AGPL-3.0-only`).

Copyright © 2026 Richard Becker

See `LICENSE` for the full license text.

## Backup

Back up the writable data volume containing the SQLite database and keep deployment configuration/secrets separately. No Jellyfin media directory or Jellyfin internal database is required.

## Update

Pull the new image/source, rebuild and restart. Database migrations run during application startup before requests and jobs are served.

The UI version is displayed in the sidebar. Every code or documentation change bumps the app version according to impact.

```sh
docker compose up --build -d
```

## Attribution

TMDB is used as the primary metadata provider when configured. This product uses the TMDB API but is not endorsed or certified by TMDB.

TVmaze is used as an optional fallback provider when enabled. TVmaze data is licensed under CC BY-SA; provide attribution when exposing TVmaze-derived metadata.
