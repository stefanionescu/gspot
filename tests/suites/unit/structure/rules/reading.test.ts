import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { TRIVIAL_FUNCTION_RULE } from '@config/tests/sources'
import { parseRule } from '@/structure/rules'

describe('parseRule', () => {
  it('keeps the ast-grep document as it was written, so the file runs under sg unchanged', () => {
    const rule = parseRule(TRIVIAL_FUNCTION_RULE, 'trivial.yml')
    assert.equal(rule.id, 'structure/trivial-function')
    assert.equal(rule.language, 'TypeScript')
    assert.deepEqual(Object.keys(rule.rule), ['kind', 'has'])
  })

  it('refuses a document with no rule, which would match nothing and report every file clean', () => {
    const headerOnly = 'id: structure/x\nlanguage: TypeScript\nmessage: nothing\n'
    assert.throws(() => parseRule(headerOnly, 'x.yml'), /`rule` is required/u)
  })

  it('refuses a document with no id, because a finding with no rule name cannot be suppressed', () => {
    const anonymous = TRIVIAL_FUNCTION_RULE.replace('id: structure/trivial-function', '')
    assert.throws(() => parseRule(anonymous, 'x.yml'), /`id` is required/u)
  })

  it('names the file when the YAML itself will not parse', () => {
    assert.throws(() => parseRule('id: [unterminated\n', 'broken.yml'), /broken\.yml is not valid YAML/u)
  })

  it('refuses a document that is a list rather than one rule', () => {
    assert.throws(() => parseRule('- id: a\n- id: b\n', 'many.yml'), /holds one document/u)
  })
})
