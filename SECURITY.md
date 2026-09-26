# Security Policy

## Supported Versions

Security fixes are prepared for the current `main` branch and the latest published release once public releases exist.

## Reporting a Vulnerability

Please do not publish security issues as public tracker issues before maintainers have had a reasonable opportunity to investigate and prepare a fix.

Report suspected vulnerabilities to:

```text
[security contact to be defined before public release]
```

Include affected version, deployment mode, reproduction steps and relevant logs without secrets.

## Intended Operation

Lutrafin is designed for self-hosted HomeLab and household dashboard deployments. Prefer HTTPS behind a maintained reverse proxy, VPN-only access, or local network access without direct public port forwarding.

Avoid direct unprotected Internet exposure. If exposing Lutrafin beyond a trusted network, use HTTPS, strong admin credentials, timely updates and appropriate reverse-proxy access controls.

## Secrets

Never commit Jellyfin tokens, TMDB tokens, TVDB tokens, notification provider tokens, admin passwords, `.env` files, private certificates or private keys. Rotate any secret that was ever committed to Git history.

## Security Notes

- Admin write actions require login and server-side sessions.
- Public read access is intentional for overview-style household dashboards.
- HTTPS-only browser policies such as HSTS are opt-in to preserve direct HTTP HomeLab operation by default.
- Notification provider secrets are stored server-side, are never returned to Settings page data and should not be logged.
