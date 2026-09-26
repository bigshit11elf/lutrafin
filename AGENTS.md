# Agent Instructions

Diese Datei ist die verbindliche Arbeitsanweisung für KI-Agenten und für
menschliche Beitragende in diesem Repository. Sie wird vor jedem Commit und
vor jedem Push gelesen.

## Vor jedem Commit / Push (Pflicht, immer vollständig)

Diese Checkliste ist **keine Empfehlung**. Ein Commit oder Push ist erst
erlaubt, wenn alle fünf Punkte erledigt sind. Reihenfolge einhalten.

1. **Versionsnummer erhöhen**
   - `package.json` (`version`), `package-lock.json` (beide Stellen: Root und
     `packages."".version`) und `src/lib/version.ts` (`appVersion`) auf dieselbe
     neue Version setzen.
   - Bei Patch-Änderung: letzte Ziffer erhöhen (z. B. `0.2.53` -> `0.2.54`).
   - Versionsnummer nie nur in einer der drei Dateien ändern.
2. **Doku pflegen**
   - `DEVELOPMENT_LOG.md`: neuen Eintrag mit Datum, Überschrift und
     `### Changed` / `### Fixed` / `### Added` / `### Removed` anlegen sowie den
     Abschnitt `## Current State` (inkl. `Last completed`, `Build`, `Tests`) und
     bei Bedarf `## Next Actions` aktualisieren. Jeder Abschluss wird protokolliert.
   - Bei Verhaltens- oder Konfigurationsänderungen zusätzlich `README.md`,
     `ARCHITECTURE.md`, `CONTRIBUTING.md` oder `SECURITY.md` aktualisieren.
   - `RELEASE_CHECKLIST.md` abhaken, wenn ein Punkt durch die Änderung erledigt ist.
3. **Release-Script aktualisieren**
   - `npm run release:zip` ausführen, damit `release/lutrafin-<version>-docker.zip`
     zur neuen Version passt (`/release` ist gitignored, das Artefakt bleibt lokal).
   - Der Inhalt des Release-Zips ist in `scripts/create-release-zip.sh` definiert.
     Neue benötigte Dateien müssen dort sowohl in der `require_file`-Liste als auch
     in der `copy_path`-Liste ergänzt werden.
4. **Checks laufen lassen**
   ```sh
   npm run check
   npm run lint
   npm test
   npm run build
   ```
   Alle vier müssen ohne Fehler durchlaufen. Testergebnisse und
   Build-Status in `DEVELOPMENT_LOG.md` festhalten.
5. **Commit-Nachricht im Repo-Stil**
   - Kurzer, aussagekräftiger Subject im Imperativ, z. B.
     `Fix settings notification submit target`, `Rebrand to Lutrafin and fix settings feedback`.
   - Höchstens ein Commit pro zusammengehörigen Änderungsblock. Keine
     `Amend`s auf fehlgeschlagene Commits, keine Force-Pushes, keine
     `--no-verify`, keine Änderungen an der Git-Config.
   - Niemals Secrets, Tokens, Passwörter, private URLs oder `.env` committen.

## Projektkonventionen

- Stack: SvelteKit 2 (Svelte 5 Runes), TypeScript, Drizzle ORM + better-sqlite3,
  `adapter-node`, Docker-Auslieferung.
- Sprache der UI und der Doku: Englisch. `src/lib/i18n.ts` enthält je ein
  vollständiges Wörterbuch für `en` und `de`; neue UI-Texte gehören in beide.
- Drittanbieter-Links in `THIRD_PARTY_NOTICES.md` niemals auf das eigene Repo
  umstellen. Nur projekteigene Links (Default in
  `src/lib/server/config/app-config.ts`, `.env.example`, `README.md`) sind
  `https://github.com/bigshit11elf/lutrafin`.
- Keine Kommentare im Code, sofern nicht ausdrücklich gewünscht.
- Bestehender Stil und bestehende Muster haben Vorrang vor neuen Vorlieben.
- Bei Datenbankänderungen Migration anlegen und in
  `src/lib/server/infrastructure/database/migrations/meta/_journal.json`
  registrieren.
- `AGPL-3.0-only` bleibt unverändert; `LICENSE` und `THIRD_PARTY_NOTICES.md`
  nicht eigenmächtig umschreiben.

## Verifikation

- Verhalten bevorzugt end-to-end prüfen, nicht nur statisch: für UI-Änderungen
  den Dev-Server starten und den echten Ablauf (Login, Formular, Feedback)
  durchspielen. Ein 404, 500 oder unbehandelter Promise-Rejection im Browser
  gilt als Fehler, auch wenn `npm run check` und `npm test` grün sind.
- Nur behaupten, was tatsächlich verifiziert wurde; Umgebungseinschränkungen
  (z. B. kein Docker-Daemon) explizit in `DEVELOPMENT_LOG.md` und in der
  Antwort an den Nutzer nennen.
