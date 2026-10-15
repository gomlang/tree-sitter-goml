# tree-sitter-goml

A Tree-sitter grammar for the GoML programming language (`.goml`). It includes a generated C parser, syntax highlighting and symbol queries, corpus tests, and incremental parsing tests.

The syntax baseline is GoML 0.1.60 and compiler revision `840e493e08d64b65bc5422f6e826936516107f17`, particularly `docs/goml.md`, `gomlc/lexer/lexer.goml`, and `gomlc/parser/`. Compiler behavior and executable fixtures take precedence over the abbreviated documentation grammar.

## Build and test

Requirements: Node.js 20 or newer, npm, and a C compiler. The development dependency pins Tree-sitter CLI to 0.26.9. The generated parser uses language ABI 15; embedding applications need a Tree-sitter runtime supporting that ABI (0.25 or newer).

```sh
npm ci
npm run generate
npm run build
npm test
npm run check:scanner
```

`npm test` runs the corpus, highlighting assertions, malformed-source and recovery checks, query checks, and incremental-versus-fresh parsing comparisons. Tests use temporary files and do not modify your global Tree-sitter configuration.

To parse, highlight, or extract symbols, run these commands from this directory:

```sh
npx tree-sitter parse --config-path tree-sitter-config.json examples/showcase.goml
npx tree-sitter highlight --config-path tree-sitter-config.json examples/showcase.goml
npx tree-sitter tags --config-path tree-sitter-config.json examples/showcase.goml
```

The local CLI configuration searches the parent directory for this `tree-sitter-goml` directory. For use elsewhere, add its parent directory to `parser-directories` in your own Tree-sitter configuration, or supply an equivalent config with an absolute path.

## Editor integration

The grammar name is `goml`, its scope is `source.goml`, and its extension is `.goml`. Compile both `src/parser.c` and `src/scanner.c` with `src` on the include path. The exported language function is `tree_sitter_goml()`.

Install `queries/highlights.scm` and `queries/tags.scm` in the locations expected by your editor. Highlight captures use the Tree-sitter CLI's standard capture names. This directory supplies the C grammar and queries; editor-specific registration and language bindings are separate integration steps.

The root node is `source_file`. Declarations expose fields such as `name`, `parameters`, `return_type`, and `body`; expressions expose fields such as `left`, `right`, `operator`, and `value`. A block's final expression has the `value` field, while expressions followed by semicolons are `expression_statement` nodes. `src/node-types.json` describes the complete node interface.

## Syntax coverage

- Packages, imports and aliases, visibility, nested attributes, constants and statics.
- Functions, structs and newtypes, enums, traits, implementations, associated items, and external declarations.
- Square-bracket generics, const arguments, `where` clauses, associated types, function types, `dyn` and opaque returns.
- Calls and `::[T]` arguments, indexing, fields, operators, ranges, closures, assignments, and block values.
- Pattern destructuring, guards, rest patterns, aliases, alternatives, condition chains, and labeled loops.
- `select`/`priority`/`when`, `scope`, `spawn`, `go`, `defer`, and `comptime`.
- Numeric, character, byte, escaped, raw, multiline, and interpolated literals; line comments and documentation highlighting.

Contextual words such as `scope`, `spawn`, `select`, and `comptime` also work as ordinary identifiers. Raw strings use a stateless external scanner to match arbitrary hash delimiters. Interpolation contents are parsed as expressions, including nested strings and blocks. Multiline strings require at least two consecutive lines beginning with `\\`.

This is an editor parser, not the GoML type checker. Name capitalization, visibility, type and const-expression validity, restrictions on opaque return positions, and other semantic checks remain with the compiler. Some invalid expression combinations may still form syntax trees; this grammar does not reproduce every compiler diagnostic. Documentation comment attachment is also a compiler concern. There is no block-comment syntax.

Explicit generic arguments must be nonempty. Enum owner arguments work in calls and constructor values, such as `Value::[bool]::Item(true)` and `Value::[bool]::Item`. Named-field literals and updates use contextual types instead: `let value: Box[bool] = Box { value: true };`.

## Real-source regression check

With local GoML and optional ecosystem checkouts, and `rg` installed:

```sh
npm run test:sources -- /path/to/goml /path/to/gomlang
```

The script checks compiler, driver and library sources, successful `pipeline` and `module` fixtures, and ecosystem `.goml` files. It excludes this grammar's own fixtures and the compiler's diagnostic/crasher fixture directories. Expected failures are tested separately by the integration suite. Paths are supplied explicitly and are not saved in generated artifacts.

The verification against the current baseline parsed 3,430 source files from local GoML and ecosystem checkouts without `ERROR` or `MISSING` nodes.

## Maintenance

Edit `grammar.js`, `src/scanner.c`, and the queries; regenerate the files in `src` with `npm run generate`. Add focused examples under `test/corpus`, review their expected trees, and run `npm test`. Use `npx tree-sitter test --update` only when deliberately updating expected syntax trees. Commit generated parser files along with grammar changes so consumers can build without running the generator.
