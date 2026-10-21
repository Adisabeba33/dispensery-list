import { Children, type ReactNode } from 'react';

/* Which build this is, for us rather than for visitors: the version raised in
   every pull request, the commit, and when it was built. If the version named
   in a pull request is not here yet, the old build is still being served.
   Whatever is passed in follows on the same line — the home page adds the
   date of its data. Where the line is too long for the screen it breaks
   between parts, never inside one, and a part that starts a line loses its
   dot: each dot sits in a gutter before its part, and the line is pulled left
   by one gutter so the first one on every line falls out of sight. */
export const BuildStamp = ({ children }: { children?: ReactNode }) => {
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
  const parts = [
    <span key="version" className="text-chalk-400">
      v{version}
    </span>,
    commit,
    when && `built ${when}`,
    ...Children.toArray(children),
  ].filter(Boolean);
  return (
    <div className="overflow-x-clip py-0.5">
      <p className="-ml-6 flex flex-wrap font-mono text-[0.625rem] leading-relaxed tracking-[0.04em] tabular-nums text-moss-600/85">
        {parts.map((part, i) => (
          <span key={i} className="whitespace-nowrap">
            <span aria-hidden className="inline-block w-6 whitespace-pre text-center text-chalk-500">
              {' · '}
            </span>
            {part}
          </span>
        ))}
      </p>
    </div>
  );
};
