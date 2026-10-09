// The managed attributes block keeps LF in every whole file gspot writes, so a CRLF checkout does not read as an edit.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/git.ts';
import { rm, readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';

test('the attributes block keeps LF in each generated file, including one in a scope folder with a space', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['security', 'format'], {
            tables: '[scope."web app"]\nconfigurations = ["security", "javascript"]\n',
        }),
        'web app/page.js': 'export const page = 1;\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const generated = emitAll(await openSession(sandbox.path));
    const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
    await Bun.write(join(sandbox.path, '.gitattributes'), `${attributes.block}\n`);
    const outside = generated.files.map(({ path }) => path).filter((path) => !path.startsWith('.gspot/'));
    expect(outside).toContain('web app/.semgrepignore');
    const read = git(sandbox.path, ['check-attr', 'eol', '--', ...outside, 'nested/.editorconfig']);
    expect(read.code, read.stderr).toBe(0);
    expect(read.stdout.trim().split('\n')).toStrictEqual([
        ...outside.map((path) => `${path}: eol: lf`),
        'nested/.editorconfig: eol: unspecified',
    ]);
});

test('generated attributes preserve LF through autocrlf checkout', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { agentRules: true }),
        '.gitattributes': '*.txt text\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = '.gspot/rules/general/engineering/agent/WORKING.md';
    const bytes = await readFile(join(sandbox.path, path));
    expect(git(sandbox.path, ['add', '--', '.gitattributes', path]).code).toBe(0);
    const attributes = git(sandbox.path, ['check-attr', 'text', 'eol', 'linguist-generated', '--', path]);
    expect(attributes.code, attributes.stderr).toBe(0);
    expect(attributes.stdout.split('\n').filter(Boolean)).toStrictEqual([
        `${path}: text: set`,
        `${path}: eol: lf`,
        `${path}: linguist-generated: set`,
    ]);
    await rm(join(sandbox.path, path));
    const checked = git(sandbox.path, ['-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path]);
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});
