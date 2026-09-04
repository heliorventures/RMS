import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative } from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
const assetsRoot = join(root, 'public', 'assets');
const outputRoot = join(root, 'public', 'dist');
const manifest = {};
const textExtensions = new Set(['.css', '.csv', '.html', '.js', '.json', '.svg', '.txt']);

const vendorFiles = [
  ['vendor/bootstrap/bootstrap.min.css', 'node_modules/bootstrap/dist/css/bootstrap.min.css'],
  ['vendor/bootstrap/bootstrap.bundle.min.js', 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js'],
  ['vendor/bootstrap-icons/fonts/bootstrap-icons.woff', 'node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff'],
  ['vendor/bootstrap-icons/fonts/bootstrap-icons.woff2', 'node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2'],
  ['vendor/chart/chart.umd.js', 'node_modules/chart.js/dist/chart.umd.js'],
  ['vendor/jquery/jquery.min.js', 'node_modules/jquery/dist/jquery.min.js'],
  ['vendor/datatables/jquery.dataTables.min.js', 'node_modules/datatables.net/js/jquery.dataTables.min.js'],
  ['vendor/datatables/dataTables.bootstrap5.min.css', 'node_modules/datatables.net-bs5/css/dataTables.bootstrap5.min.css'],
  ['vendor/datatables/dataTables.bootstrap5.min.js', 'node_modules/datatables.net-bs5/js/dataTables.bootstrap5.min.js'],
  ['vendor/html2pdf/html2pdf.bundle.min.js', 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js']
];

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}

function outputName(logicalName, bytes) {
  const extension = extname(logicalName);
  return `${logicalName.slice(0, -extension.length)}.${hash(bytes)}${extension}`;
}

async function minifyJavaScript(bytes, sourcefile) {
  const result = await transform(bytes.toString('utf8'), {
    minify: true,
    legalComments: 'inline',
    sourcefile,
    target: 'es2020'
  });
  return Buffer.from(result.code, 'utf8');
}

async function addAsset(logicalName, sourcePath, { minify = false } = {}) {
  let bytes = await readFile(sourcePath);
  if (minify && extname(logicalName) === '.js') bytes = await minifyJavaScript(bytes, logicalName);
  else if (textExtensions.has(extname(logicalName))) bytes = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'), 'utf8');
  const targetName = outputName(logicalName, bytes);
  const target = join(outputRoot, targetName);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  manifest[`/assets/${logicalName.replaceAll('\\', '/')}`] = `/dist/${targetName.replaceAll('\\', '/')}`;
}

async function addApplicationTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await addApplicationTree(sourcePath);
      continue;
    }
    if (entry.name.endsWith('.map')) continue;
    const logicalName = relative(assetsRoot, sourcePath).replaceAll('\\', '/');
    await addAsset(logicalName, sourcePath, { minify: entry.name.endsWith('.js') });
  }
}

async function build() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await addApplicationTree(assetsRoot);
  for (const [logicalName, relativeSource] of vendorFiles) {
    await addAsset(logicalName, join(root, relativeSource), { minify: logicalName.endsWith('.js') });
  }

  let iconCss = await readFile(join(root, 'node_modules/bootstrap-icons/font/bootstrap-icons.min.css'), 'utf8');
  for (const extension of ['woff', 'woff2']) {
    const target = manifest[`/assets/vendor/bootstrap-icons/fonts/bootstrap-icons.${extension}`];
    iconCss = iconCss.replaceAll(`fonts/bootstrap-icons.${extension}?dd67030699838ea613ee6dbda90effa6`, `fonts/${target.split('/').at(-1)}`);
  }
  const iconCssBytes = Buffer.from(iconCss, 'utf8');
  const iconCssName = outputName('vendor/bootstrap-icons/bootstrap-icons.min.css', iconCssBytes);
  await mkdir(dirname(join(outputRoot, iconCssName)), { recursive: true });
  await writeFile(join(outputRoot, iconCssName), iconCssBytes);
  manifest['/assets/vendor/bootstrap-icons/bootstrap-icons.min.css'] = `/dist/${iconCssName}`;
  await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Built ${Object.keys(manifest).length} hashed assets.`);
}

await build();
