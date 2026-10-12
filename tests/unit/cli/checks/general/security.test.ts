import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';

const ALIASED_SETTINGS = settingsText(['security'], {
    tables: '[tools.codeql]\nlanguages = ["javascript-typescript", "javascript"]\n',
    level: 'all',
});

test('CodeQL runs in a scratch copy that is deleted afterwards and leaves the repository unchanged', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['security'], {
            tables: '[tools.codeql]\nlanguages = ["python"]\n',
            level: 'all',
        }),
        'source.py': 'value = 1\n',
    });
    const copies: string[] = [];
    // What the database creation saw in its copy of the repository.
    const sources: string[] = [];
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'run').mockImplementation(async (argv, options) => {
            if (argv.includes('resolve'))
                return processResult({ stdout: JSON.stringify({ aliases: {}, extractors: { python: [{}] } }) });
            const { cwd } = options;
            copies.push(cwd);
            if (argv.includes('create')) {
                sources.push(await readFile(join(cwd, 'source.py'), 'utf8'));
                await writeFile(join(cwd, 'generated.py'), 'build side effect');
            }
            const output = argv.find((part) => part.startsWith('--output='));
            if (output !== undefined)
                await Bun.write(output.slice('--output='.length), '{"version":"2.1.0","runs":[{"results":[]}]}');
            return processResult();
        }),
    );
    const corrected = await openSession(directory.path);
    resources.use(mockPinnedExecutables([toolDeclaration(corrected.manifests.values(), 'codeql')]));
    expect(await checkFindings(corrected.root, 'security/codeql')).toStrictEqual([]);
    expect(copies).not.toContain(directory.path);
    expect(sources).toStrictEqual(['value = 1\n']);
    expect(await pathExists(join(directory.path, 'generated.py'))).toBe(false);

    expect(await Promise.all(copies.map((copy) => pathExists(copy)))).toStrictEqual(copies.map(() => false));
});

test('CodeQL uses its own language names and the pinned packs once and maps SARIF locations to repository files', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': ALIASED_SETTINGS,
        'source file.ts': 'export const source = true;\n',
    });
    const session = await openSession(directory.path);
    const pin = toolDeclaration(session.manifests.values(), 'codeql');
    using _pins = mockPinnedExecutables([pin]);
    // Every database creation and analysis the check ran, with the copy it ran in.
    const invoked: { argv: readonly string[]; cwd: string }[] = [];
    using _run = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
        const base = { code: 0, missing: false, stderr: '', duration: 1 };
        if (argv.includes('resolve'))
            return {
                ...base,
                stdout: '{"aliases":{"javascript-typescript":"javascript"},"extractors":{"javascript":[{}]}}',
            };
        const cwd = options.cwd;
        invoked.push({ argv, cwd });
        if (argv.includes('analyze')) {
            const output = argv.find((part) => part.startsWith('--output='))!;
            const physicalLocation = {
                artifactLocation: { uri: pathToFileURL(join(cwd, 'source file.ts')).href },
                region: { startLine: 1, startColumn: 14 },
            };
            const result = {
                ruleId: 'js/sql-injection',
                message: { text: 'Test injection' },
                locations: [{ physicalLocation }],
            };
            await writeFile(
                output.slice('--output='.length),
                JSON.stringify({ version: '2.1.0', runs: [{ results: [result] }] }),
            );
        } else if (!argv.includes('create')) throw new Error('Unexpected CodeQL command');
        return { ...base, stdout: '' };
    });
    const findings = await checkFindings(session.root, 'security/codeql');
    expect(invoked.map(({ cwd }) => cwd)).not.toContain(directory.path);
    const option = (command: string, prefix: string) =>
        invoked
            .filter(({ argv }) => argv.includes(command))
            .map(({ argv }) => argv.find((part) => part.startsWith(prefix)));
    expect(option('create', '--language=')).toStrictEqual(['--language=javascript']);
    expect(option('analyze', 'codeql/')).toStrictEqual([
        `codeql/javascript-queries@${pin.query_packs!['javascript']!}:codeql-suites/javascript-security-and-quality.qls`,
    ]);
    expect(await readFile(join(directory.path, 'source file.ts'), 'utf8')).toBe('export const source = true;\n');
    expect(findings).toMatchObject([
        { check: 'security/codeql', rule: 'js/sql-injection', file: 'source file.ts', line: 1, column: 14 },
    ]);
});
