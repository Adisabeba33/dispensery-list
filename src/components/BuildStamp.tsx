/* Which build this is, for us rather than for visitors: the version raised in
   every pull request, the commit, and when it was built. If the version named
   in a pull request is not here yet, the old build is still being served. */
export const BuildStamp = () => {
  const version = process.env.APP_VERSION;
  const commit = process.env.BUILD_COMMIT;
  const built = process.env.BUILD_TIME;
  const when = built
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(built)) + ' ET'
    : null;
  return (
    <p className="font-mono text-[0.7rem] tabular-nums text-chalk-500">
      {['v' + version, commit, when && `built ${when}`].filter(Boolean).join(' · ')}
    </p>
  );
};
