import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell py-24 text-center">
      <p className="label">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-chalk-50">
        No such dispensary here
      </h1>
      <p className="mx-auto mt-4 max-w-md text-chalk-400">
        The page you asked for is not in the register. It may have been removed, or the licence may
        never have been listed.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg border border-moss-600/60 bg-moss-600/12 px-5 py-2.5 text-sm font-medium text-moss-400 transition-colors hover:bg-moss-600/20"
      >
        Back to the directory
      </Link>
    </div>
  );
}
