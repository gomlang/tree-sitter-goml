const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { test, after } = require('node:test');

const root = resolve(__dirname, '../..');
const temporary = mkdtempSync(join(tmpdir(), 'tree-sitter-goml-'));
const localCli = join(root, 'node_modules/tree-sitter-cli/tree-sitter');
const cli =
  process.env.TREE_SITTER_CLI ||
  (existsSync(localCli) ? localCli : 'tree-sitter');
const config = join(temporary, 'config.json');
writeFileSync(
  config,
  JSON.stringify({ 'parser-directories': [resolve(root, '..')] }),
);
after(() => rmSync(temporary, { recursive: true, force: true }));

function run(command, args) {
  const result = spawnSync(cli, [command, '--config-path', config, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

function parse(source, edits = []) {
  const file = join(temporary, 'source.goml');
  writeFileSync(file, source);
  const result = run('parse', [
    file,
    ...(edits.length ? ['--edits', ...edits] : []),
  ]);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  const tree = result.stdout
    .split('\n')
    .filter((line) => /^\s*(?:\(|\w+: \()/.test(line))
    .join('\n');
  assert.ok(tree.startsWith('(source_file'), result.stdout + result.stderr);
  return { tree, status: result.status, output: result.stdout };
}

const invalid = [
  ['reserved function name', 'fn if() {}'],
  ['reserved binding name', 'fn f() { let fn = 1; }'],
  ['empty argument with comma', 'fn f() { call(,); }'],
  ['empty array with comma', 'fn f() { [,]; }'],
  ['empty struct with comma', 'struct A { , }'],
  ['empty function type arguments', 'fn f() { identity::[](1); }'],
  ['empty enum owner type arguments', 'fn f() { Value::[]::Item(1); }'],
  ['empty enum variant type arguments', 'fn f() { Value::Item::[](1); }'],
  ['empty method type arguments', 'fn f() { value.method::[](); }'],
  ['named struct type arguments', 'fn f() { Box::[bool] { value: true }; }'],
  ['struct update type arguments', 'fn f() { Box::[bool] { ..base }; }'],
  [
    'named enum owner type arguments',
    'fn f() { Value::[bool]::Named { value: true }; }',
  ],
  [
    'named enum variant type arguments',
    'fn f() { Value::Named::[bool] { value: true }; }',
  ],
  ['multiple slice rests', 'fn f() { let [.., ..] = xs; }'],
  ['struct rest must be last', 'fn f() { let A { .., x } = value; }'],
  ['struct update must be last', 'fn f() { A { ..base, x: 1 }; }'],
  ['missing let semicolon', 'fn f() { let x = 1 }'],
  ['missing assignment semicolon', 'fn f() { x = 1 }'],
  ['missing expression semicolon', 'fn f() { work() next() }'],
  ['missing let value', 'fn f() { let x = ; }'],
  ['missing field colon', 'struct A { value isize }'],
  ['missing parameter colon', 'fn f(value isize) {}'],
  ['missing argument comma', 'fn f() { call(1 2); }'],
  ['unclosed parameters', 'fn f(value: isize {}'],
  ['unclosed block', 'fn f() { let x = 1;'],
  ['unclosed string', 'fn f() { "text }'],
  ['unclosed raw string', 'fn f() { r##"text"#; }'],
  ['unclosed byte string', 'fn f() { br#"text; }'],
  ['unclosed interpolation', 'fn f() { f"value={x"; }'],
  ['bare interpolation brace', 'fn f() { f"text }"; }'],
  ['invalid string escape', String.raw`fn f() { "\q"; }`],
  ['non-ASCII byte string', 'fn f() { b"中文"; }'],
  ['non-ASCII raw byte string', 'fn f() { br#"中文"#; }'],
  ['non-ASCII byte', "fn f() { b'中'; }"],
  ['invalid numeric separator', 'fn f() { 1__2; }'],
  ['invalid hexadecimal digit', 'fn f() { 0xG; }'],
  ['unsupported numeric suffix', 'fn f() { 1u8; }'],
  ['single-line multiline string', 'fn f() {\n  \\\\only one line\n}'],
  ['block comments', '/* no block comments */ fn f() {}'],
  ['misplaced use declaration', 'fn f() {} use std::io;'],
  ['misplaced package declaration', 'fn f() {} package main;'],
  [
    'labeled loop missing semicolon',
    "fn f() { 'outer: loop { break } work(); }",
  ],
];

for (const [name, source] of invalid) {
  test(`reports syntax errors: ${name}`, () => {
    const result = parse(source);
    assert.equal(result.status, 1, result.tree);
    assert.match(result.output, /\b(?:ERROR|MISSING)\b/);
  });
}

for (const source of [
  'fn broken() { let value = ; }\nfn intact() { 42 }',
  'fn broken() { call(1 2); }\nfn intact() { 42 }',
  'fn broken() { let value = 1;\nfn intact() { 42 }',
]) {
  test(`recovers following function: ${source.split('\n')[0]}`, () => {
    const result = parse(source);
    assert.equal(result.status, 1);
    assert.match(result.tree, /function_item \[1, 0\]/);
  });
}

test('block tail controls have a value field and semicolon controls are statements', () => {
  assert.match(parse('fn f() { if ready {} }').tree, /value: \(if_expression/);
  assert.match(
    parse('fn f() { if ready {}; }').tree,
    /\(expression_statement[^\n]*\n\s+\(if_expression/,
  );
  assert.match(
    parse('fn f() { if ready {} next() }').tree,
    /\(expression_statement[^\n]*\n\s+\(if_expression/,
  );
});

test('booleans and primitive types are distinct from identifier prefixes', () => {
  const result = parse(
    'fn f() { let true_value: bool = true; let false_value: bool = false; let isize_value: isize = 1; }',
  );
  assert.equal(result.status, 0);
  assert.equal((result.tree.match(/\(boolean_literal/g) || []).length, 2);
  assert.equal((result.tree.match(/\(primitive_type/g) || []).length, 3);
});

test('enum owner arguments apply to tuple, unit and constructor values', () => {
  const result = parse(
    'fn f() { Value::[bool]::Item(true); Value::[bool]::Empty; let make = Value::[bool]::Item; Array::[isize, 2]::Item([1, 2]); Array::[isize, { SIZE + 1 }]::Item; }',
  );
  assert.equal(result.status, 0, result.tree);
  assert.equal((result.tree.match(/\(scoped_generic_identifier/g) || []).length, 5);
});

const incrementalCases = [
  ['raw contents', 'fn f() { r##"alpha "# beta"## }', 'alpha', '中文'],
  ['raw opening delimiter', 'fn f() { r#"text"# }', 'r#', 'r##'],
  ['raw closing delimiter', 'fn f() { r##"text"## }', '"##', '"#'],
  ['raw prefix to byte prefix', 'fn f() { r#"ascii"# }', 'r#', 'br#'],
  ['raw prefix to normal string', 'fn f() { r"text" }', 'r"', '"'],
  ['byte string becomes invalid', 'fn f() { br#"ascii"# }', 'ascii', '中'],
  [
    'interpolation expression',
    'fn f() { f"value={a + b}" }',
    'a + b',
    'call("x", 2)',
  ],
  [
    'interpolation nesting',
    'fn f() { f"value={a}" }',
    '{a}',
    '{f"nested {b}"}',
  ],
  ['escaped interpolation brace', 'fn f() { f"{{ready}}" }', '{{', '{'],
  [
    'multiline continuation',
    'fn f() {\n\\\\one\n\\\\two\n}',
    '\\\\two',
    'value',
  ],
  ['contextual keyword', 'fn f() { scope }', 'scope', 'scope { work() }'],
  [
    'condition and block boundary',
    'fn f() { if ready { 1 } else { 2 } }',
    'ready',
    '(Point { x: 1 }).x > 0',
  ],
  ['generic call to indexing', 'fn f() { use_value::[T](x); }', '::[T]', '[0]'],
  ['enum owner arguments', 'fn f() { Value::[bool]::Item(true); }', 'bool', '[u8; 3]'],
  ['loop label', "fn f() { 'outer: loop { break 'outer } }", "'outer:", ''],
  ['Unicode offset', 'fn f() { "中文"; r#"text"# }', 'text', 'edited'],
  [
    'CRLF strings',
    'fn f() {\r\n\\\\first\r\n\\\\second\r\n}',
    'second',
    'changed',
  ],
];

for (const [name, source, before, replacement] of incrementalCases) {
  test(`incremental parse matches a fresh parse: ${name}`, () => {
    assert.equal(parse(source).status, 0);
    const offset = source.indexOf(before);
    assert.notEqual(offset, -1);
    const position = Buffer.byteLength(source.slice(0, offset));
    const length = Buffer.byteLength(before);
    const edited =
      source.slice(0, offset) +
      replacement +
      source.slice(offset + before.length);
    const result = parse(source, [`${position} ${length} ${replacement}`]);
    const fresh = parse(edited);
    assert.equal(result.status, fresh.status);
    assert.equal(result.tree, fresh.tree);
  });
}

test('large raw delimiters and nested interpolations', () => {
  const hashes = '#'.repeat(512);
  const raw = `r${hashes}"a "${hashes.slice(1)} inside"${hashes}`;
  assert.equal(parse(`fn f() { ${raw} }`).status, 0);
  let nested = 'value';
  for (let i = 0; i < 20; i++) nested = `f"{${nested}}"`;
  assert.equal(parse(`fn f() { ${nested} }`).status, 0);
});

test('tag queries emit definitions and calls', () => {
  const result = run('tags', ['examples/showcase.goml']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Greeting\s+\| class\s+def/);
  assert.match(result.stdout, /main\s+\| function\s+def/);
  assert.match(result.stdout, /first\s+\| call\s+ref/);
  assert.match(result.stdout, /render\s+\| call\s+ref/);
});

test('highlight queries compile and use standard captures', () => {
  const result = run('highlight', ['--check', 'examples/showcase.goml']);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /Warning|Error/);
});

test('multiple incremental edits restore matching raw delimiters', () => {
  const source = 'fn f() { r#"text"# }';
  const end = source.indexOf('"#') + 2;
  const start = source.indexOf('r#') + 2;
  const result = parse(source, [`${end} 0 #`, `${start} 0 #`]);
  const fresh = parse('fn f() { r##"text"## }');
  assert.equal(result.status, 0);
  assert.equal(result.tree, fresh.tree);
});
