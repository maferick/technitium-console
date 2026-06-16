# Contributing

Thanks for your interest. This started as a personal itch (I did not enjoy the stock admin UI, so
I built my own), and it's shared in the hope it's useful. Contributions of all sizes are welcome:
bug reports, fixes, new screens, wording, docs, themes.

There is **no CLA**. By contributing you agree your work is released under the project's
[MIT License](LICENSE). You keep your copyright; you just license it to everyone, same as the rest
of the project.

## Reporting bugs

Open a [bug report](https://github.com/maferick/technitium-console/issues/new?template=bug_report.yml).
The single most useful thing you can include is, from your browser DevTools (F12):

- the **Console** tab: any red error text, and
- the **Network** tab: for a failed action, the `/api/...` request URL and the JSON response.

Also note your **Technitium DNS Server version**, since the REST API changes between releases.
Please redact any session tokens.

## Development setup

Requirements: Node 20+ and a reachable Technitium DNS Server.

```bash
git clone https://github.com/maferick/technitium-console.git
cd technitium-console
npm install

# point the dev proxy at your Technitium web service, then start Vite:
TECHNITIUM_DEV_PROXY=http://192.168.1.5:5380 npm run dev
```

Open the printed URL and log in with your Technitium credentials. The dev server proxies `/api`
to `TECHNITIUM_DEV_PROXY` (default `http://localhost:5380`), so there's no CORS to fight.

Useful scripts:

- `npm run typecheck` - strict TypeScript check (CI runs this; keep it green)
- `npm run build` - production build to `dist/`
- `npm run preview` - serve the production build locally

## Project layout

```
src/
  lib/api.ts        typed client for every Technitium REST endpoint used
  lib/format.ts     wording + display helpers (humanised labels, sorting)
  components/       Layout, command palette, reusable UI kit, Zone/DNSSEC modals
  pages/            one file per screen (Dashboard, Zones, DHCP, Settings, Admin, ...)
```

## Conventions

- TypeScript, React function components, Tailwind utility classes. Reuse the helpers in
  `components/ui.tsx` (`Card`, `Field`, `Modal`, `Menu`, `toast`, ...) and the CSS component
  classes in `src/index.css` (`input`, `btn-primary`, `btn-ghost`, `card`, `chip`).
- Match the existing style and density. New API calls go in `src/lib/api.ts`.
- Keep `npm run typecheck` and `npm run build` passing.

## Pull requests

1. Fork, branch, commit.
2. Run `npm run typecheck` and `npm run build`.
3. Open a PR describing the change. Screenshots help a lot for UI work.

Small, focused PRs get merged faster. For larger changes, opening an issue or Discussion first
to align on direction is appreciated, but not required.
