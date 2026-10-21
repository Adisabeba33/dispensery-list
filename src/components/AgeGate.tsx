'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ny-dispensary-register:age-affirmed';

/**
 * Age affirmation, as New York's Part 129 marketing rules require of a site
 * that carries cannabis content. It is a declaration, not a check: nobody's
 * age is verified, and the gate is trivially bypassed. Its purpose is to state
 * the audience plainly and record that the visitor answered — which is what
 * the rule asks for, and is the pattern every licensed dispensary site uses.
 */
export const AgeGate = () => {
  // Start hidden so the page never flashes the gate at someone who already
  // answered; the effect decides on the client, where storage is readable.
  const [state, setState] = useState<'checking' | 'asking' | 'declined' | 'passed'>('checking');

  useEffect(() => {
    let affirmed = false;
    try {
      affirmed = window.localStorage.getItem(STORAGE_KEY) === 'yes';
    } catch {
      // Private browsing or blocked storage: ask again rather than assume.
    }
    setState(affirmed ? 'passed' : 'asking');
  }, []);

  const affirm = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'yes');
    } catch {
      // Not remembering is acceptable; blocking the page over it is not.
    }
    setState('passed');
  };

  if (state === 'checking' || state === 'passed') return null;

  /* A panel in the kit's dim frame, bracketed at two corners, over the page
     dimmed behind it: the one question, the yes lit as the main action. */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-heading"
      className="fixed inset-0 z-50 flex overflow-y-auto bg-ink-950/95 p-5 backdrop-blur-sm"
    >
      {/* Centred by its auto margins, which, unlike centring the grid, leave
          the top reachable when a phone held sideways is shorter than the
          panel. The brackets lie on the frame's border and turn with its
          radius, as on the map's frame. */}
      <div className="card hud-corners hud-corners-round m-auto w-full max-w-md bg-ink-900/95 px-6 py-7 text-center sm:px-8 sm:py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.svg" alt="" aria-hidden width={56} height={56} className="mx-auto h-14 w-14" />

        {state === 'asking' ? (
          <>
            <h1
              id="age-gate-heading"
              className="mt-5 text-[1.625rem] font-extrabold leading-tight tracking-[-0.025em] text-chalk-50"
            >
              Are you 21 or older?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-chalk-200">
              This register lists cannabis dispensaries licensed by New York State. In New York,
              cannabis is for adults aged 21 and over.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button type="button" onClick={affirm} autoFocus className="btn btn-lit min-h-12 px-5">
                Yes, I am 21 or older
              </button>
              <button type="button" onClick={() => setState('declined')} className="btn min-h-12 px-5">
                No, I am under 21
              </button>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-chalk-400">
              We do not verify your age and we do not sell cannabis. This is an informational
              register, not affiliated with or endorsed by any state agency.
            </p>
          </>
        ) : (
          <>
            <h1
              id="age-gate-heading"
              className="mt-5 text-[1.625rem] font-extrabold leading-tight tracking-[-0.025em] text-chalk-50"
            >
              Come back when you are 21
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-chalk-200">
              New York law restricts cannabis to adults aged 21 and over, so there is nothing here
              for you yet. Nothing personal.
            </p>
            <a
              href="https://cannabis.ny.gov/"
              target="_blank"
              rel="noreferrer noopener"
              className="link mt-5 inline-block text-sm"
            >
              About cannabis law in New York
            </a>
          </>
        )}
      </div>
    </div>
  );
};
