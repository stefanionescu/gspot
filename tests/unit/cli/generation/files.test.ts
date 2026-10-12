import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/system/processes.ts';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { git, gitOutput } from '#tests/setup/git.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { rm, stat, readFile } from 'node:fs/promises';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { currentBlock } from '#cli/system/managed-blocks.ts';

test('the managed block reaches AGENTS.md and the instruction files, and a second apply leaves AGENTS.md alone', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], { rules: true }),
    });
    const selected = await runGspot(sandbox.path, ['set', 'rules.instruction_files', 'TEAM.md']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const instructions = currentBlock(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8'), {
        path: 'AGENTS.md',
        style: 'markdown',
    });
    expect(instructions).toContain('agent/WORKING.md');
    expect(
        currentBlock(await readFile(join(sandbox.path, 'TEAM.md'), 'utf8'), { path: 'TEAM.md', style: 'markdown' }),
    ).toBe(instructions);
    const attributes = await stat(join(sandbox.path, 'AGENTS.md'));
    const modified = attributes.mtimeMs;
    const again = await runGspot(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    const current = await stat(join(sandbox.path, 'AGENTS.md'));
    expect(current.mtimeMs).toBe(modified);
});

test.each(['absent', 'authored', 'managed'])(
    '%s attributes keep LF in generated files, also in a scope folder with a space',
    async (source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['security', 'format'], {
                tables: '[[scope]]\npath = "web app"\n\nconfigurations = ["security", "javascript"]\n',
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

test('generated attributes keep LF through an autocrlf checkout', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], { rules: true }),
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

test('switching the level and back writes the same files and the AGENTS.md level', async () => {
    await using sandbox = await testdir();
    await Bun.write(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: string[] = [];
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const settings = settingsText(['javascript'], { rules: true, level: level });
        await Bun.write(join(sandbox.path, 'gspot.toml'), settings);
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const config = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!;
        using log = openOwnershipLog(sandbox.path);
        writeGeneratedFiles(session, output, log);
        const block = output.blocks.find((block) => block.path === 'AGENTS.md')!.block;
        expect(block).toContain(`Level: \`${level}\``);
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});

test.each([true, false])(
    'apply writes the .gitignore block only once Git exists, with your own file=%s',
    async (authored) => {
        await using repository = await testdir();
        const original = '# Authored entries\nprivate.tmp\n';
        await createFileTree(repository.path, {
            'gspot.toml': settingsText([]),
            ...(authored ? { '.gitignore': original } : {}),
        });
        {
            using log = openOwnershipLog(repository.path);
            const session = await openSession(repository.path);
            writeGeneratedFiles(session, emitAll(session), log);
        }
        const path = join(repository.path, '.gitignore');
        // Generation keeps any existing file outside Git. It creates no new file.
        expect((await pathExists(path)) ? await readFile(path, 'utf8') : undefined).toBe(
            authored ? original : undefined,
        );
        const initialized = await run(['git', 'init', '--quiet'], { cwd: repository.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        {
            using log = openOwnershipLog(repository.path);
            const session = await openSession(repository.path);
            writeGeneratedFiles(session, emitAll(session), log);
        }
        const installed = await readFile(path, 'utf8');
        expect(installed.startsWith(original)).toBe(authored);
        expect(installed).toContain('.gspot/state/');
        {
            using log = openOwnershipLog(repository.path);
            const session = await openSession(repository.path);
            writeGeneratedFiles(session, emitAll(session), log);
        }
        expect(await readFile(path, 'utf8')).toBe(installed);
    },
);
