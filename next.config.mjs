import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/* What the home page says about the build it is: the version, the commit and
   the hour it was built. The version is raised by hand in every pull request;
   the commit and the hour change on every deploy by themselves — a merge from
   another session, or the daily shelf run, redeploys without anyone raising
   anything — so between them a glance at the page says whether a change has
   landed or the old build is still being served. */
const commit = () => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    APP_VERSION: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
    BUILD_COMMIT: commit().slice(0, 7),
    BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
