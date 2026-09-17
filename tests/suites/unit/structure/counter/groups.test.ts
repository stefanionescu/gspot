import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { parse } from '@ast-grep/napi'
import { overflows } from '@/structure/counter'
import { registerGrammars } from '@/structure/grammar'

await registerGrammars()

function matches(grammar: string, source: string, kinds: readonly string[]) {
  return parse(grammar, source)
    .root()
    .findAll({ rule: { any: kinds.map((kind) => ({ kind })) } })
}

const TWO_FUNCTIONS = `busy() {
  a=1
  a=2
  a=3
}
calm() {
  b=1
}
`

describe('overflows, per function', () => {
  it('counts each function separately, so one over does not carry the other with it', () => {
    const found = overflows(matches('bash', TWO_FUNCTIONS, ['variable_assignment']), 'per-function', 2, 'bash')
    assert.deepEqual(
      found.map((over) => [over.subject, over.count]),
      [['busy', 3]],
    )
  })

  it('reports nothing at the limit, because a limit is what is allowed', () => {
    assert.deepEqual(overflows(matches('bash', TWO_FUNCTIONS, ['variable_assignment']), 'per-function', 3, 'bash'), [])
  })

  it('ignores a match outside any function, which has no function to be over the limit in', () => {
    const found = matches('bash', 'a=1\na=2\na=3\na=4\n', ['variable_assignment'])
    assert.deepEqual(overflows(found, 'per-function', 1, 'bash'), [])
  })
})

const NESTED = `deep() {
  if true; then
    for f in a; do
      while true; do
        echo 1
      done
    done
  fi
}
flat() {
  if true; then echo 1; fi
  if true; then echo 2; fi
  if true; then echo 3; fi
}
`

describe('overflows, nesting', () => {
  it('measures how deep the matches go rather than how many there are', () => {
    const kinds = ['if_statement', 'for_statement', 'while_statement']
    const found = overflows(matches('bash', NESTED, kinds), 'nesting', 2, 'bash')
    assert.deepEqual(
      found.map((over) => [over.subject, over.count]),
      [['deep', 3]],
    )
  })
})

describe('overflows, per file', () => {
  it('counts every match in the file as one group', () => {
    const found = matches('bash', TWO_FUNCTIONS, ['variable_assignment'])
    assert.deepEqual(
      overflows(found, 'per-file', 3, 'bash').map((over) => over.count),
      [4],
    )
  })
})

describe('overflows, nodes', () => {
  it('measures the syntax under each match, so a short function building a large expression counts', () => {
    const small = matches('bash', 'a=1\n', ['variable_assignment'])
    const large = matches('bash', 'a="$(b "$(c "$(d)")")"\n', ['variable_assignment'])
    assert.equal(overflows(small, 'nodes', 4, 'bash').length, 0)
    assert.equal(overflows(large, 'nodes', 4, 'bash').length, 1)
  })
})
