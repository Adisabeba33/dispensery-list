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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-heading"
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/95 p-5 backdrop-blur-sm"
    >
      <div className="card w-full max-w-md p-7 text-center">
        <span
          aria-hidden
          className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-moss-600/50 bg-moss-600/10 text-moss-400"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        {state === 'asking' ? (
          <>
            <h1 id="age-gate-heading" className="mt-5 text-xl font-semibold tracking-tight text-chalk-50">
              Are you 21 or older?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-chalk-200">
              This register lists cannabis dispensaries licensed by New York State. In New York,
              cannabis is for adults aged 21 and over.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={affirm}
                autoFocus
                className="rounded-lg border border-moss-600/60 bg-moss-600/15 px-5 py-3 text-sm font-medium text-moss-400 transition-colors hover:bg-moss-600/25"
              >
                Yes, I am 21 or older
              </button>
              <button
                type="button"
                onClick={() => setState('declined')}
                className="rounded-lg border border-ink-700 px-5 py-3 text-sm text-chalk-400 transition-colors hover:border-ink-600 hover:text-chalk-200"
              >
                No, I am under 21
              </button>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-chalk-500">
              We do not verify your age and we do not sell cannabis. This is an informational
              register, not affiliated with or endorsed by any state agency.
            </p>
          </>
        ) : (
          <>
            <h1 id="age-gate-heading" className="mt-5 text-xl font-semibold tracking-tight text-chalk-50">
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
