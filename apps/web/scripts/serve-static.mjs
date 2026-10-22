// Serves a built directory (Storybook's `storybook-static`) on 127.0.0.1 for the visual suite
// (28 §4): `node scripts/serve-static.mjs <dir> <port>`. Files only, no directory listings.
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const [dir, port] = process.argv.slice(2)
if (!dir || !port) throw new Error('usage: serve-static.mjs <dir> <port>')
const root = resolve(dir)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  const path = normalize(join(root, pathname === '/' ? 'index.html' : pathname))
  let size = -1
  try {
    if (path.startsWith(root + sep)) size = statSync(path).isFile() ? statSync(path).size : -1
  } catch {
    size = -1
  }
  if (size < 0) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    'content-length': size,
  })
  createReadStream(path).pipe(res)
}).listen(Number(port), '127.0.0.1')
