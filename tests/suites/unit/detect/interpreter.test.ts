import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { interpreterOf } from '@/detect/interpreter'

describe('interpreterOf', () => {
  it('reads the interpreter out of a direct shebang', () => {
    assert.equal(interpreterOf('#!/bin/bash'), 'bash')
  })

  it('reads through env', () => {
    assert.equal(interpreterOf('#!/usr/bin/env bash'), 'bash')
  })

  it('reads past the flags env takes', () => {
    assert.equal(interpreterOf('#!/usr/bin/env -S bash -euo pipefail'), 'bash')
  })

  it('reports none for a line that is not a shebang', () => {
    assert.equal(interpreterOf('# a comment'), null)
    assert.equal(interpreterOf(''), null)
  })
})
