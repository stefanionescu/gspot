// The managed attributes block keeps LF in every whole file gspot writes, so a CRLF checkout does not read as an edit.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rm, readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { git, gitOutput } from '#tests/harness/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';

test.each(['absent', 'authored', 'managed'])(
    '%s attributes keep LF in generated files, including a scope folder with a space',
    async (source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['security', 'format'], {
                tables: '[scope."web app"]\nconfigurations = ["security", "javascript"]\n',
            }),
            'web app/page.js': 'export const page = 1;\n',
            ...(source === 'absent'
                ? {}
                : {
                      '.gitattributes':
                          source === 'authored'
                              ? '* text=auto eol=lf\n'
                              : '# >>> gspot managed >>>\n* text=auto eol=lf\n# <<< gspot managed <<<\n',
                  }),
        });
        gitOutput(sandbox.path, ['init', '-q']);
        const generated = emitAll(await openSession(sandbox.path));
        const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
        expect(attributes.block.includes(' text eol=lf')).toBe(source !== 'authored');
        await Bun.write(
            join(sandbox.path, '.gitattributes'),
            `${source === 'authored' ? '* text=auto eol=lf\n' : ''}${attributes.block}\n`,
        );
        const outside = generated.files.map(({ path }) => path).filter((path) => !path.startsWith('.gspot/'));
        expect(outside).toContain('web app/.semgrepignore');
        const read = gitOutput(sandbox.path, ['check-attr', 'eol', '--', ...outside, 'nested/.editorconfig']);
        expect(read.split('\n')).toStrictEqual([
            ...outside.map((path) => `${path}: eol: lf`),
            `nested/.editorconfig: eol: ${source === 'authored' ? 'lf' : 'unspecified'}`,
        ]);
    },
);

test('generated attributes preserve LF through autocrlf checkout', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { agentRules: true }),
        '.gitattributes': '*.txt text\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = '.gspot/rules/general/engineering/agent/WORKING.md';
    const bytes = await readFile(join(sandbox.path, path));
    gitOutput(sandbox.path, ['add', '--', '.gitattributes', path]);
    await rm(join(sandbox.path, path));
    const checked = git(sandbox.path, ['-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path]);
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});
