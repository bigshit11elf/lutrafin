# Contributing

Thank you for considering a contribution to Lutrafin.

By submitting a contribution, you agree that your contribution is licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`).

## Requirements

- Contributions must be your own work or work you are legally allowed to submit.
- Do not copy proprietary code, documentation, assets, icons, logos or test data into this repository.
- Do not commit secrets, real API tokens, passwords, private URLs that should remain private, private certificates or personal data.
- Use dummy values in examples.
- Respect third-party API, trademark, logo and attribution rules.

## Development Checks

Before submitting a change, run the relevant checks:

```sh
npm run check
npm run lint
npm test
npm run build
```

For database changes, add a migration and ensure it is registered in `src/lib/server/infrastructure/database/migrations/meta/_journal.json`.

## Style

- Prefer small, focused changes.
- Keep HTTP/HomeLab deployments working by default.
- Make stricter HTTPS-only hardening opt-in unless there is a clear safe default.
- Update documentation when behavior or configuration changes.
