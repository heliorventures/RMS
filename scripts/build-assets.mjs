import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const root = process.cwd();
const source = join(root, 'public', 'assets');
const output = join(root, 'public', 'dist');
const manifest = {};

async function addTree(directory) {
  const files = await (await import('node:fs/promises')).readdir(directory, { withFileTypes: true });
  for (const entry of files) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) await addTree(full);
    else {
      const bytes = await readFile(full);
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      const name = entry.name.replace(/(\.[^.]+)$/, `.${hash}$1`);
      const target = join(output, relative(source, directory), name);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, bytes);
      manifest[`/assets/${relative(source, full).replaceAll('\\', '/')}`] = `/dist/${relative(output, target).replaceAll('\\', '/')}`;
    }
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await addTree(source);
await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${Object.keys(manifest).length} hashed assets.`);
