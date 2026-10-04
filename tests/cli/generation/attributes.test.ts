// The managed attributes block keeps LF in every whole file gspot writes, so a CRLF checkout does not read as an edit.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';

test('the attributes block keeps LF in each generated file, including one in a scope folder with a space', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['security', 'format'], {
            tables: '[agent_rules]\nenabled = false\n[[scope]]\npath = "web app"\nconfigurations = ["security", "javascript"]\n',
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
