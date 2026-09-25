# Working on this repository

## Every pull request raises the version

The home page shows which build is live, above "New York City · Westchester
County": `v1.0.0 · 0cfa60f · built Sep 24, 10:05 AM ET`. The owner checks it to
see whether a merged change has reached the site or the old build is still
being served.

- Raise `version` in `package.json` in every pull request that changes the site
  or the collector: the patch number (`1.0.0` → `1.0.1`) for a fix, the minor
  (`1.0.x` → `1.1.0`) for something new.
- Raise it above the highest version main has ever had, not above the one your
  branch started from. Two sessions work here at once: on 25 September a branch
  cut at 1.2.2 merged as 1.2.3 after main had reached 1.3.1, and the home page
  went backwards — the owner could no longer tell a new build from an old one.
  Before merging, look:

      git fetch origin main
      git log origin/main --format=%s -- package.json | grep -o '^v[0-9.]*' | sort -V | tail -1

  and if main is at or past your version, raise yours again.
- Start the commit subject with the version (`v1.3.2: …`), as the history does,
  so the highest one is found by the command above.
- Name the new version in the pull request's description, so the owner knows
  what to look for.
- The commit and the build time fill themselves in at build (`next.config.mjs`);
  nothing to do for those.
