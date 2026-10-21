import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { generate } from '#cli/generation/generate.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { runGit, readGitOutput } from '#tests/setup/git.ts';
import { applyGeneratedFiles } from '#tests/setup/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';

test.each(['absent', 'authored', 'managed'])(
    '%s attributes keep LF in generated files, also in a scope folder with a space',
    async (source) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['security', 'format'], {
                scopes: [{ path: 'web app', configurations: ['security', 'javascript', 'css'] }],
            }),
            'web app/page.js': 'export const page = 1;\n',
            'web app/style.css': 'a { color: red; }\n',
            ...(source === 'absent'
                ? {}
                : {
                      '.gitattributes':
                          source === 'authored'
                              ? '* text=auto eol=lf\n'
                              : '# >>> gspot managed >>>\n* text=auto eol=lf\n# <<< gspot managed <<<\n',
                  }),
        });

        readGitOutput(sandbox.path, ['init', '-q']);
        const generated = generate(await openSession(sandbox.path));
        const attributes = generated.blocks.find(({ path }) => path === '.gitattributes')!;
        expect(attributes.block.includes(' text eol=lf')).toBe(source !== 'authored');
        await writeFile(
            join(sandbox.path, '.gitattributes'),
            `${source === 'authored' ? '* text=auto eol=lf\n' : ''}${attributes.block}\n`,
        );
        const outside = generated.files.map(({ path }) => path).filter((path) => !path.startsWith('.gspot/'));
        expect(outside).toContain('web app/.stylelintrc.json');
        const read = readGitOutput(sandbox.path, ['check-attr', 'eol', '--', ...outside, 'nested/.editorconfig']);
        expect(read.split('\n')).toStrictEqual([
            ...outside.map((path) => `${path}: eol: lf`),
            `nested/.editorconfig: eol: ${source === 'authored' ? 'lf' : 'unspecified'}`,
        ]);
    },
);
test('generated attributes keep LF through an autocrlf checkout', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        '.gitattributes': '*.txt text\n',
    });

    readGitOutput(sandbox.path, ['init', '-q']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = '.gspot/configurations/general/engineering/rules/WORKING.md';
    const bytes = await readFile(join(sandbox.path, path));
    readGitOutput(sandbox.path, ['add', '--', '.gitattributes', path]);
    await rm(join(sandbox.path, path));
    const checked = runGit(sandbox.path, ['-c', 'core.autocrlf=true', 'checkout-index', '--force', '--', path]);
    expect(checked.code, checked.stderr).toBe(0);
    const checkedBytes = await readFile(join(sandbox.path, path));
    expect(checkedBytes).toStrictEqual(bytes);
});
test.each([true, false])(
    'apply writes the .gitignore block only once Git exists, with your own file=%s',
    async (authored) => {
        await using repository = await testdir();
        const original = '# Authored entries\nprivate.tmp\n';
        await createFileTree(repository.path, {
            'gspot.toml': buildSandboxSettings([]),
            ...(authored ? { '.gitignore': original } : {}),
        });
        await applyGeneratedFiles(repository.path);
        const path = join(repository.path, '.gitignore');
        // Generation keeps any existing file outside Git. It creates no new file.
        expect((await isOnDisk(path)) ? await readFile(path, 'utf8') : undefined).toBe(authored ? original : undefined);
        const initialized = runGit(repository.path, ['init', '--quiet']);
        expect(initialized.code, initialized.stderr).toBe(0);
        await applyGeneratedFiles(repository.path);
        const installed = await readFile(path, 'utf8');
        expect(installed.startsWith(original)).toBe(authored);
        expect(installed).toContain('.gspot/state/');
        await applyGeneratedFiles(repository.path);
        expect(await readFile(path, 'utf8')).toBe(installed);
    },
);
