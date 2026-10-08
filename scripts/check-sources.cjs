const { spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join, relative, isAbsolute } = require('node:path');

const root = resolve(__dirname, '..');
const [gomlArg, ecosystemArg, ...extra] = process.argv.slice(2);
if (extra.length || !gomlArg) {
  console.error(
    'Usage: npm run test:sources -- /path/to/goml [/path/to/gomlang]',
  );
  process.exit(2);
}
const goml = resolve(gomlArg);
const ecosystem = ecosystemArg && resolve(ecosystemArg);
const localCli = join(root, 'node_modules/tree-sitter-cli/tree-sitter');
const cli =
  process.env.TREE_SITTER_CLI ||
  (existsSync(localCli) ? localCli : 'tree-sitter');

function files(directory) {
  const result = spawnSync('rg', ['--files', '-g', '*.goml', directory], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || `No GoML files in ${directory}`);
  return result.stdout.trim().split('\n');
}

function outsideGrammar(file) {
  const path = relative(root, file);
  return path === '..' || path.startsWith('../') || isAbsolute(path);
}

const paths = new Set();
for (const folder of ['gomlc', 'goml', 'lib']) {
  for (const file of files(join(goml, folder))) {
    if (!file.split('/').includes('testdata')) paths.add(file);
  }
}
for (const folder of ['pipeline', 'module']) {
  for (const file of files(join(goml, 'gomlc/testdata', folder)))
    paths.add(file);
}
if (ecosystem) {
  for (const file of files(ecosystem)) {
    if (outsideGrammar(file)) paths.add(file);
  }
}

const temporary = mkdtempSync(join(tmpdir(), 'tree-sitter-goml-sources-'));
try {
  const manifest = join(temporary, 'paths.txt');
  const config = join(temporary, 'config.json');
  writeFileSync(manifest, [...paths].sort().join('\n') + '\n');
  writeFileSync(
    config,
    JSON.stringify({ 'parser-directories': [resolve(root, '..')] }),
  );
  console.log(`Parsing ${paths.size} GoML source files`);
  const result = spawnSync(
    cli,
    [
      'parse',
      '--config-path',
      config,
      '--quiet',
      '--stat',
      '--paths',
      manifest,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      timeout: 120000,
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status === 0 ? 0 : 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
