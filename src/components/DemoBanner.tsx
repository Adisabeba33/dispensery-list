/**
 * Shown whenever data/dispensaries.json is still empty. The site is useless — and
 * dangerous — if a visitor mistakes a seven-record sample for the full register,
 * so this cannot be dismissed away. Drawn as the kit's caution note, across the
 * top of the page, above its head.
 */
export const DemoBanner = () => (
  <div className="shell pt-4 sm:pt-6">
    <div className="note note-caution flex flex-wrap items-baseline gap-x-3 gap-y-2 bg-amber-400/[0.06]">
      <span className="pill shrink-0 border-amber-400/50 bg-amber-400/15 text-amber-400">Sample data</span>
      <p className="min-w-0 flex-1 basis-60 text-chalk-200">
        This is a seven-record preview, not the register. Licence numbers here come from press
        reporting and have not yet been matched against the state registry.
      </p>
    </div>
  </div>
);
