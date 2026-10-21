import Link from 'next/link';
import clsx from 'clsx';

/*
 * The parts every page of the register is built from, so a page reads as
 * part of the same record as the home page: the same head, the same frames
 * for figures, the same chevron on everything that opens. The classes behind
 * them (.kicker, .page-title, .lede, .section-title, .stamp, .note, .tag,
 * .btn, .expander, .row-link, .tabs) live in globals.css.
 */

/** Points right; turns down inside an open <details> or an aria-expanded="true" button. */
export const Chevron = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx('chev h-4 w-4', className)}
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/** "← Back to strains", in the stamp's mono, over a page's kicker. */
export const BackLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link
    href={href}
    className="stamp -mx-1 inline-flex min-h-8 items-center gap-1.5 rounded px-1 transition-colors hover:text-moss-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
    {children}
  </Link>
);

/**
 * The head of every page but the home page: an optional way back, the
 * kicker, the title, what sits beside the title (a count, an icon), what
 * follows it (pills, a stamp) and the lede.
 */
export const PageHead = ({
  back,
  kicker,
  title,
  aside,
  meta,
  children,
  className,
}: {
  back?: { href: string; label: string };
  kicker?: React.ReactNode;
  title: React.ReactNode;
  /** Beside the title, at its right: a count, a figure. */
  aside?: React.ReactNode;
  /** Right under the title: pills, a licensee's name, a stamp. */
  meta?: React.ReactNode;
  /** The lede, and anything else that belongs to the head. */
  children?: React.ReactNode;
  className?: string;
}) => (
  <header className={clsx('pt-6 sm:pt-10 lg:pt-12', className)}>
    {back && (
      <div className="mb-3">
        <BackLink href={back.href}>{back.label}</BackLink>
      </div>
    )}
    {kicker && <p className="kicker">{kicker}</p>}
    <div className={clsx('flex items-start justify-between gap-4', kicker && 'mt-3')}>
      <h1 className="page-title min-w-0 max-w-4xl break-words">{title}</h1>
      {aside && <div className="shrink-0 pt-1">{aside}</div>}
    </div>
    {meta && <div className="mt-3">{meta}</div>}
    {children && <div className="lede mt-4 max-w-2xl space-y-4">{children}</div>}
  </header>
);

/**
 * Figures in a row of separate boxes, the first one lit, over a rule with a
 * gauge's ticks at its start — as on the home page. Four fit one row on a
 * phone; more, or longer labels, wrap.
 */
export const StatBoxes = ({
  figures,
  className,
}: {
  figures: { label: string; value: React.ReactNode }[];
  className?: string;
}) => (
  <div className={clsx('sm:w-max', className)}>
    <dl className="flex flex-wrap gap-1.5 sm:gap-2">
      {figures.map((figure, i) => (
        <div
          key={figure.label}
          className={clsx(
            'relative flex flex-auto flex-col-reverse rounded-[5px] px-2.5 py-2 [@media(max-width:374px)]:px-2 [@media(min-width:400px)]:px-3.5 sm:min-w-[8rem] sm:flex-none sm:px-4 sm:py-3.5 lg:min-w-[9.5rem] lg:px-5',
            // Its stretch of the rule beneath the row, lit under the first.
            'after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[0.6875rem] after:h-px',
            // The lit box is the second widest, as drawn, where the row
            // has the room; on a narrower phone it would push the row
            // onto two lines. (Plain media variants: Tailwind's min-[…]
            // goes away beside the em-based `nav` screen.)
            i === 0
              ? 'card-lit [@media(min-width:420px)_and_(max-width:639px)]:min-w-[5.875rem] after:bg-moss-400 after:shadow-[0_0_6px_rgba(var(--glow),0.8)]'
              : 'border border-ink-600 bg-ink-900/70 after:bg-moss-700/45',
          )}
        >
          <dt className="mt-0.5 whitespace-nowrap text-[0.72rem] leading-tight text-chalk-200 sm:text-sm">
            {figure.label}
          </dt>
          <dd className="bg-gradient-to-b from-moss-300 to-moss-400 bg-clip-text text-[1.3rem] font-semibold leading-tight tabular-nums text-transparent sm:text-[1.75rem]">
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
    {/* A rule under the row, with a gauge's ticks standing on its start. */}
    <div aria-hidden className="mt-[0.9375rem]">
      <div className="h-[3px] w-7 bg-[repeating-linear-gradient(90deg,rgba(var(--glow),0.45)_0_1px,transparent_1px_3px)] opacity-70" />
      <div className="h-px bg-gradient-to-r from-moss-700/50 via-moss-700/35 to-moss-700/10" />
    </div>
  </div>
);
