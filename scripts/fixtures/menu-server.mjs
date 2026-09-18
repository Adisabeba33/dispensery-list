/**
 * The fixture storefront, served the way the real ones serve themselves.
 *
 * It used to be `python3 -m http.server`, which hands back the same file
 * whatever the query string says — and a menu that ignores the page parameter
 * is exactly the case the paging must NOT be tested against, because it passes
 * by doing nothing. This serves the shelf in pages of three out of five, states
 * its own total, and returns an empty page past the end.
 *
 *   node scripts/fixtures/menu-server.mjs 4399
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), 'menu-shop');
const PORT = Number(process.argv[2]) || 4399;

const PRODUCTS = JSON.parse(readFileSync(resolve(HERE, 'api/products.json'), 'utf8')).data.products;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};

const file = (name) => {
  const body = readFileSync(resolve(HERE, name));
  const ext = name.slice(name.lastIndexOf('.'));
  return [body, TYPES[ext] ?? 'application/octet-stream'];
};

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/products.json') {
    const page = Number(url.searchParams.get('page') ?? 0);
    const perPage = Number(url.searchParams.get('perPage') ?? 3);
    const slice = PRODUCTS.slice(page * perPage, page * perPage + perPage);
    res.writeHead(200, { 'content-type': 'application/json' });
    // The total travels with the products, which is what makes it comparable
    // to what we read: it counts this query, not the shop's whole catalogue.
    res.end(JSON.stringify({ data: { products: slice, total_count: PRODUCTS.length } }));
    return;
  }

  try {
    /* Extensionless addresses, because that is how a menu is usually
       published — /menu, not /menu.html — and the collector guesses those. */
    const ROUTES = { '/': 'index.html', '/menu': 'menu.html', '/nolink': 'nolink.html' };
    const name = ROUTES[url.pathname] ?? url.pathname.slice(1);
    const [body, type] = file(name);
    res.writeHead(200, { 'content-type': type });
    // A HEAD answers whether the address exists and sends nothing, which is
    // the whole point of asking with one.
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT);
