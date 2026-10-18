/**
 * Where the reader said they are, remembered across the register's pages.
 *
 * The directory has kept its whole view in one stored record since before
 * there was any other page that measures distance: the search, the filters,
 * the scroll, and the point. A strain's page reads the point from the same
 * record and writes it back there, so a reader who shared a location on one
 * page sees distances on the other without being asked twice.
 *
 * The point is remembered, not the permission: nothing here reads the
 * location again on its own.
 */
export const VIEW_KEY = 'ny-dispensary-register:view';

export type Origin = { lat: number; lng: number; label: string };

const readView = (): Record<string, unknown> => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(VIEW_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
};

export const savedOrigin = (): { origin: Origin | null; zip: string } => {
  const view = readView();
  const o = view.origin as Origin | null | undefined;
  return {
    origin: o && typeof o.lat === 'number' && typeof o.lng === 'number' ? o : null,
    zip: typeof view.zip === 'string' ? view.zip : '',
  };
};

/** The point and the ZIP into the shared record, leaving the rest of it as it was. */
export const saveOrigin = (origin: Origin | null, zip: string) => {
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify({ ...readView(), origin, zip }));
  } catch {
    // Not remembering is a small loss; failing the page is not.
  }
};
