// Web: book files are served by the site itself (public/data links to assets/). See remote-data.ts for the apps.

/** One `/data/...json` file, or null if it isn't there. */
export function getData(path: string): Promise<unknown> {
  return fetch(path)
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
    .catch(() => null);
}
