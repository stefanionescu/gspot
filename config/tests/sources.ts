import type { Files } from '@config/tests/repositories'

export const TRIVIAL_FUNCTION_RULE = `
id: structure/trivial-function
language: TypeScript
message: This function's whole body is one call.
rule:
  kind: function_declaration
  has:
    field: body
    kind: statement_block
    all:
      - has:
          nthChild: 1
          kind: return_statement
          has:
            kind: call_expression
      - not:
          has:
            nthChild: 2
`

export const WRAPPERS_AND_WORK = `// Every export carries a comment, so a test of one rule trips only that one.

/** Forwards both arguments unchanged. */
export function forwards(a: number, b: string) {
  return build(a, b)
}

/** Forwards both arguments, in the other order. */
export function reordered(a: number, b: string) {
  return build(b, a)
}

/** Builds a value, then returns it. */
export function twoStatements(a: number, b: string) {
  const merged = build(a, b)
  return merged
}

/** Returns nothing for a missing input. */
export function guards(a: number | null) {
  if (a === null) return null
  return build(a)
}
`

export const SHELL_WRAPPER_RULE = `
id: structure/trivial-function
language: bash
message: This function's whole body is one call.
rule:
  kind: function_definition
  has:
    kind: compound_statement
    all:
      - has:
          nthChild: 1
          kind: command
      - not:
          has:
            nthChild: 2
`

export const UNPARSEABLE_SHELL = `#!/usr/bin/env bash
if [ 1 ]; then
  echo "\${hostname%%\\]*}"

deploy() {
  run_deploy "$@"
}
`

export const PARSEABLE_SHELL = `#!/usr/bin/env bash
if [ 1 ]; then
  echo "ok"
fi

deploy() {
  run_deploy "$@"
}
`

export const CALL_THROUGHS: Files = {
  'src/wrap.ts': `export function passes(a: number, b: string) {
  return build(a, b)
}
export function reorders(a: number, b: string) {
  return build(b, a)
}
export function drops(a: number, b: string) {
  return build(a)
}
export function adds(a: number, b: string) {
  return build(a, b, 1)
}
export function works(a: number) {
  return build(a) + 1
}
export function twoStatements(a: number) {
  const held = build(a)
  return held
}
`,
  'src/wrap.py': `def passes(a, b):
    return build(a, b)

def typed(a: int, b: str = "x"):
    return build(a, b)

def reorders(a, b):
    return build(b, a)

def works(a):
    return build(a) + 1
`,
  'src/wrap.swift': `func passes(a: Int, b: String) -> Int { return build(a, b) }
func labelled(_ a: Int, with b: String) -> Int { return build(a, b) }
func reorders(a: Int, b: String) -> Int { return build(b, a) }
`,
}

export const REPEATED_BODIES: Files = {
  'src/read.ts': `export function readUser(id: string) {
  const row = db.find(id)
  if (row === null) throw new Error('missing')
  return row
}
export function readOrder(key: string) {
  const row = db.find(key)
  if (row === null) throw new Error('missing')
  return row
}
export function readItem(ref: string) {
  const row = db.find(ref)
  if (row === null) throw new Error('missing')
  return row
}
export function different(id: string) {
  const row = db.find(id)
  if (row === null) return null
  return row
}
export function tiny() {
  return 1
}
export function alsoTiny() {
  return 1
}
`,
}

export const EXTENSIONLESS_SCRIPTS: Files = {
  'ops/deploy': `#!/usr/bin/env -S bash -euo pipefail
deploy() {
  run_deploy "$@"
}
`,
  'ops/migrate': `#!/usr/bin/env python3
def migrate(a, b):
    return build(a, b)
`,
  'ops/notes': `# Not a script at all, and named like one.
nothing here
`,
}
