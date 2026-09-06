# Deploying

The site is a **static export** — `next build` writes plain HTML, CSS and JS to
`out/`. There is no server, no database and no runtime secret, so it can be
hosted anywhere that serves files.

```bash
npm ci
npm run validate   # never ship data that fails validation
npm run build      # → out/
```

## Vercel

The repo needs no configuration. Import it at vercel.com/new, pick the
repository, and press Deploy — Vercel detects Next.js on its own. Because
`next.config.mjs` sets `output: 'export'`, the result is a static site: no
server, no runtime environment variables, nothing to provision.

Defaults that are already correct, so leave them alone:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Build command | `next build` |
| Output directory | (leave empty) |
| Install command | `npm ci` |
| Environment variables | none |

The build takes about a minute and produces 463 pages, one per dispensary plus
the directory, county and notices pages.

Every push to the default branch redeploys. A pull request gets its own preview
URL, which is the sane way to look at a data refresh before it goes live.

Playwright is deliberately **not** a project dependency. Vercel installs
devDependencies in order to build, and the `playwright` package pulls several
hundred megabytes of browsers in a postinstall hook — for a tool only the menu
collection job in CI ever runs. That workflow installs it itself.

```bash
npx vercel --prod   # or from the command line, once linked
```

## Netlify / Cloudflare Pages / GitHub Pages

- Build command: `npm run build`
- Publish directory: `out`

`trailingSlash: true` is already set, so directory-style URLs resolve correctly
on hosts that serve `index.html` from a folder.

## Any static host

Copy `out/` to the document root. Nothing else is required.

## The single-file snapshot

```bash
npm run preview    # → preview/index.html
```

This inlines the whole dataset into one self-contained HTML file — useful for
sending a snapshot to someone without deploying anything. It carries the
sample-data banner automatically while `data/dispensaries.json` is still empty,
and drops it once real data lands.

## Updating the data on a live site

Data is versioned in the repo, not in a database, so a data update is a commit:

```bash
npm run ingest
npm run validate
git commit -am "data: refresh from NY OCM registry"
git push
```

The host rebuilds and the new register is live. A scheduled weekly job running
those same three steps is enough to keep the register current.

## The build command matters

`npm run build` is `node scripts/emit-shop-menus.mjs && next build`. The first
half writes `public/shelves/<licence>.json` — one file per shop with a
collected menu — which the directory fetches when a card is expanded. Those
files are generated, not committed, so a deployment configured to run
`next build` directly would ship a site whose menus never open.

Vercel runs the `build` script from package.json, so the default configuration
is correct and nothing needs setting. If the build command is ever overridden,
it must keep the script. A card that cannot load its shelf says so and links to
the shop's own page rather than showing an empty menu, so the failure is
visible rather than silent — but it is still a failure.

## Keeping the data current

A snapshot goes stale: licences lapse, shops open and close, and a register
that quietly drifts out of date is worse than one that admits it knows nothing.

`.github/workflows/weekly-refresh.yml` runs every Monday. It fetches the state
registry, rebuilds the records, merges them with the enrichment already held,
validates the result, and opens a pull request. **Nothing publishes itself** —
the pull request carries a plain-language report of what changed, and a person
decides.

The merge step is not optional. `compile-research.py` writes the dataset from
scratch and knows nothing about the previous file, so running it alone would
erase every geocode, phone number and menu platform. `refresh-merge.py` puts
the two together under one ownership rule: the registry owns what a licence
is, we own what we went and found, and a licence keeps the `id` it already has
because those are published URLs.

Merging identical inputs produces no changes, and merging a registry-only
rebuild against the previous file restores all of the enrichment — both were
checked before the schedule was turned on.
