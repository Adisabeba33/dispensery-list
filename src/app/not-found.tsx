import Link from 'next/link';

/* The page head of the kit (kicker, title, lede), centred: a page with
   nothing else on it, so the one way on stands in the middle. */
export default function NotFound() {
  return (
    <div className="shell py-16 text-center sm:py-24">
      <p className="kicker justify-center after:h-px after:w-4 after:shrink-0 after:bg-moss-400 after:shadow-[0_0_6px_rgba(var(--glow),0.8)]">
        404
      </p>
      <h1 className="page-title mx-auto mt-3 max-w-2xl">No such dispensary here</h1>
      <p className="lede mx-auto mt-4 max-w-md">
        The page you asked for is not in the register. It may have been removed, or the licence may
        never have been listed.
      </p>
      <Link href="/" className="btn btn-lit mt-8 px-5">
        Back to all dispensaries
      </Link>
    </div>
  );
}
