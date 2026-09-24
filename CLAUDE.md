# Working on this repository

## Every pull request raises the version

The home page shows which build is live, above "New York City · Westchester
County": `v1.0.0 · 0cfa60f · built Sep 24, 10:05 AM ET`. The owner checks it to
see whether a merged change has reached the site or the old build is still
being served.

- Raise `version` in `package.json` in every pull request that changes the site
  or the collector: the patch number (`1.0.0` → `1.0.1`) for a fix, the minor
  (`1.0.x` → `1.1.0`) for something new.
- Name the new version in the pull request's description, so the owner knows
  what to look for.
- The commit and the build time fill themselves in at build (`next.config.mjs`);
  nothing to do for those.
