import Link from 'next/link';
import clsx from 'clsx';

/*
 * The parts every page of the register is built from, so a page reads as
 * part of the same record as the home page: the same head, the same frames
 * for figures, the same chevron on everything that opens, and the home
 * page's own search field, chips, Sort and empty list for every page that
 * filters. The classes behind them (.kicker, .page-title, .lede,
 * .section-title, .stamp, .note, .tag, .chip, .btn, .expander, .row-link,
 * .tabs, .hud-corners) live in globals.css.
 */

/** A ring the keyboard can always see, in the accent — as on the home page. */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-400';

/**
 * The home page's filter chip, for every other page's filters: 30px tall on a
 * phone with 11px words, 32px and 13px wider; lit when pressed. (The home page
 * draws its own, the same, in DirectoryExplorer.) `icon` is for a row of chips
 * that each start with a drawing — the six areas — which sit tighter on a
 * phone, so that two rows hold them at 428px; `greyIcon` keeps that drawing
 * grey until the chip is pressed. (Plain media variants: Tailwind's max-[…]
 * goes away beside the em-based `nav` screen.)
 */
export const chipClass = (on: boolean, { icon = false, greyIcon = false } = {}) =>
  clsx(
    'chip h-[1.875rem] gap-2 py-0 text-[0.6875rem] sm:h-8 sm:text-[0.8125rem]',
    icon
      ? 'pl-[0.5625rem] pr-2.5 [@media(max-width:427px)]:gap-1 [@media(max-width:427px)]:pl-[0.3125rem] [@media(max-width:427px)]:pr-1.5 sm:pl-3 sm:pr-3.5'
      : 'px-3 sm:px-3.5',
    FOCUS_RING,
    on ? 'chip-on' : clsx('text-chalk-50', greyIcon && '[&_svg]:text-chalk-200'),
  );

/** A small drawing in a frame of its own, beside a title or a card's heading:
    chalk, not green, as the home page's figures sit in theirs. Its size and
    the drawing's colour are the caller's (40px, chalk-300 unless told). */
export const IconBox = ({
  children,
  className = 'h-10 w-10 text-chalk-300',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    aria-hidden
    className={clsx('grid shrink-0 place-items-center rounded-md border border-ink-600 bg-ink-850/80', className)}
  >
    {children}
  </span>
);

/** The magnifier of the home page's search field and its empty list. */
export const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    focusable="false"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="m20.5 20.5-4.75-4.75" />
  </svg>
);

/** The sliders on the button beside a search field that opens more filters. */
export const SlidersIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    focusable="false"
    className={clsx('shrink-0', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
  >
    <path d="M3.5 6h10M18.5 6h2M3.5 12h3M11.5 12h9M3.5 18h11M19.5 18h1" />
    <circle cx="16" cy="6" r="2.25" />
    <circle cx="9" cy="12" r="2.25" />
    <circle cx="17" cy="18" r="2.25" />
  </svg>
);

/** The home page's search field, its magnifier inside at the left; the
    placeholder set smaller on a phone narrower than 428px so it fits whole,
    while typed text stays 16px, and the clear button gone until there is
    text to clear. */
export const SEARCH_FIELD =
  'field h-[2.5625rem] text-ellipsis rounded-[7px] border-moss-600/55 py-0 pl-10 pr-3 placeholder:text-[clamp(0.6875rem,4.6vw-0.42rem,0.8125rem)] placeholder:text-chalk-300 sm:h-11 sm:placeholder:text-sm [&:placeholder-shown::-webkit-search-cancel-button]:hidden';
export const SEARCH_ICON =
  'pointer-events-none absolute left-2.5 top-1/2 h-[1.375rem] w-[1.375rem] -translate-y-1/2 text-chalk-100';

/**
 * What a list shows when its filters leave nothing: the home page's empty
 * list, calmer — the dim frame, the magnifier in chalk, the sentence the page
 * has always said, and what follows it.
 */
export const EmptyState = ({
  title,
  children,
  className = 'mt-4 sm:mt-6',
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={clsx('card px-6 py-10 text-center sm:py-12', className)}>
    <IconBox className="mx-auto h-10 w-10 text-chalk-200">
      <SearchIcon className="h-5 w-5" />
    </IconBox>
    <p className="mt-4 font-semibold text-chalk-50">{title}</p>
    {children && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-chalk-300">{children}</p>}
  </div>
);

const ChevronsIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden
    focusable="false"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3.75 6 4.25-4 4.25 4M3.75 10 8 14l4.25-4" />
  </svg>
);

/**
 * The home page's Sort: the word, and a box showing the order chosen with
 * the up-and-down chevrons at its right. The select itself is invisible and
 * covers the box, at 16px so a phone does not zoom in when it is tapped, and
 * reaches a little above and below it, for a finger.
 */
export const SortSelect = <K extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: K;
  options: { id: K; label: string }[];
  onChange: (next: K) => void;
  /** The label's place in its row: ml-auto to hold it at the right. */
  className?: string;
}) => (
  <label className={clsx('flex shrink-0 items-center gap-2.5 text-[0.8125rem] text-chalk-400 sm:text-sm', className)}>
    Sort
    <span
      className={clsx(
        'relative inline-flex h-7 min-w-[5.875rem] items-center rounded-[5px] border border-moss-700/60 bg-ink-900/80 transition-colors hover:border-moss-600 sm:h-8',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-moss-400',
      )}
    >
      <span
        aria-hidden
        className="whitespace-nowrap pl-[0.6875rem] pr-7 text-[0.78125rem] text-chalk-50 sm:pl-3 sm:pr-8 sm:text-[0.8125rem]"
      >
        {(options.find((o) => o.id === value) ?? options[0])?.label}
      </span>
      <ChevronsIcon className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-200" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
        className="absolute inset-x-0 -inset-y-1 w-full cursor-pointer appearance-none bg-ink-900 text-base text-chalk-50 opacity-0 outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
    </span>
  </label>
);

/** Points right; turns down inside an open <details> or an aria-expanded="true" button.
    16px unless the caller gives it a size: the default is left off then, since
    a smaller size (h-3.5) comes before h-4 in the stylesheet and would lose. */
export const Chevron = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx('chev', !/(^|\s)h-/.test(className ?? '') && 'h-4 w-4', className)}
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
 * phone; more, or longer labels, wrap — unless `breakLabels`, for a row of
 * four whose labels are too long for one line on a phone: the row holds, the
 * labels break, and the figures stay level along the top. (A row that wrapped
 * would run the first box's lit stretch of the rule through the second row.)
 */
export const StatBoxes = ({
  figures,
  breakLabels = false,
  className,
}: {
  figures: { label: string; value: React.ReactNode }[];
  breakLabels?: boolean;
  className?: string;
}) => (
  <div className={clsx('sm:w-max', className)}>
    <dl
      className={clsx(
        'flex flex-wrap gap-1.5 sm:gap-2',
        breakLabels &&
          '[@media(max-width:639px)]:flex-nowrap [@media(max-width:639px)]:[&>div]:justify-end [@media(max-width:639px)]:[&_dt]:whitespace-normal',
      )}
    >
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
