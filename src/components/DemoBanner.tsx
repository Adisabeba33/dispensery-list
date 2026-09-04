/**
 * Shown whenever data/dispensaries.json is still empty. The site is useless — and
 * dangerous — if a visitor mistakes a seven-record sample for the full register,
 * so this cannot be dismissed away.
 */
export const DemoBanner = () => (
  <div className="border-b border-amber-400/25 bg-amber-400/[0.07]">
    <div className="shell flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-sm">
      <span className="pill border-amber-400/50 bg-amber-400/15 text-amber-400">Sample data</span>
      <p className="text-chalk-200">
        This is a seven-record preview, not the register. Licence numbers here come from press
        reporting and have not yet been matched against the state registry.
      </p>
    </div>
  </div>
);
