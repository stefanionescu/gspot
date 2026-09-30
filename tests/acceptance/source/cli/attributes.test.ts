import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { git } from '#tests/support/cli/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

test('generated attributes preserve LF through autocrlf checkout and restore authored attributes', async () => {
    await using sandbox = await testdir();
    const original = '*.txt text\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([]),
        '.gitattributes': original,
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = '.gspot/guides/general/agent/WORKING.md';
    const bytes = readFileSync(join(sandbox.path, path));
    expect(git(sandbox.path, ['add', '--', '.gitattributes', path]).code).toBe(0);
    const attributes = git(sandbox.path, ['check-attr', 'text', 'eol', 'linguist-generated', '--', path]);
    expect(attributes.code, attributes.stderr).toBe(0);
    expect(attributes.stdout.split('\n').filter(Boolean)).toStrictEqual([
        `${path}: text: set`,
        `${path}: eol: lf`,
        `${path}: linguist-generated: set`,
    ]);
    rmSync(join(sandbox.path, path));
    const checked = git(sandbox.path, ['-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path]);
    expect(checked.code, checked.stderr).toBe(0);
    expect(readFileSync(join(sandbox.path, path))).toStrictEqual(bytes);
    const removed = await run(sandbox.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readFileSync(join(sandbox.path, '.gitattributes'), 'utf8')).toBe(original);
});
