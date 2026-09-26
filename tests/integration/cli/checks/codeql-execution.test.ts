import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { codeql } from '#cli/checks/security/codeql.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { rejection } from '#tests/support/rejection.ts';

test.each(['../outside', '/outside', 'C:outside', String.raw`..\outside`])(
    'CodeQL refuses output language %s before spawning and accepts a corrected language',
    async (language) => {
        await using directory = await testdir();
        const policy = (value: string) =>
            `version = 1\nlevel = "all"\nconfigurations = ["security"]\n[tools.codeql]\nlanguages = [${JSON.stringify(value)}]\n`;
        await createFileTree(directory.path, { 'gspot.toml': policy(language), 'source.py': 'value = 1\n' });
        const session = await openSession(directory.path);
        const spec = session.manifests.get('security')!.checks.find((entry) => entry.analysis === 'codeql')!;
        const input = engineInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === '')!,
            spec: spec,
            files: session.repository.files,
        });
        const copies: string[] = [];
        // What the database creation saw in its copy of the repository.
        const sources: string[] = [];
        const run = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
            if (argv.includes('resolve'))
                return {
                    code: 0,
                    missing: false,
                    stdout: JSON.stringify({ aliases: {}, extractors: { python: [{}] } }),
                    stderr: '',
                    duration: 1,
                };
            const { cwd } = options;
            copies.push(cwd);
            if (argv.includes('create')) {
                sources.push(readFileSync(join(cwd, 'source.py'), 'utf8'));
                writeFileSync(join(cwd, 'generated.py'), 'build side effect');
            }
            const output = argv.find((part) => part.startsWith('--output='));
            if (output !== undefined)
                await Bun.write(output.slice('--output='.length), '{"version":"2.1.0","runs":[{"results":[]}]}');
            return { code: 0, missing: false, stdout: '', stderr: '', duration: 1 };
        });
        try {
            await rejection(codeql(input));
            expect(run).not.toHaveBeenCalled();
            await Bun.write(join(directory.path, 'gspot.toml'), policy('python'));
            const corrected = await openSession(directory.path);
            expect(
                await codeql(
                    engineInput(corrected, {
                        scope: corrected.scopes[0]!,
                        spec: input.spec,
                        files: corrected.repository.files,
                    }),
                ),
            ).toStrictEqual([]);
            expect(run).toHaveBeenCalledTimes(3);
            expect(copies).not.toContain(directory.path);
            expect(sources).toStrictEqual(['value = 1\n']);
            expect(existsSync(join(directory.path, 'generated.py'))).toBe(false);
            expect(copies.every((copy) => !existsSync(copy))).toBe(true);
        } finally {
            run.mockRestore();
        }
    },
);

test('CodeQL adapter uses native language names and pinned packs once and maps isolated SARIF locations', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["security"]\n[tools.codeql]\nlanguages = ["javascript-typescript", "javascript"]\n',
        'source file.ts': 'export const source = true;\n',
    });
    const session = await openSession(directory.path);
    const manifest = session.manifests.get('security')!;
    const spec = manifest.checks.find((entry) => entry.analysis === 'codeql')!;
    const packVersion = manifest.tools.find((tool) => tool.name === 'codeql')!.query_packs!['javascript'];
    // Every database creation and analysis the check ran, with the copy it ran in.
    const invoked: { argv: string[]; cwd: string }[] = [];
    const run = spyOn(processes, 'run').mockImplementation((argv, options) => {
        const base = { code: 0, missing: false, stderr: '', duration: 1 };
        if (argv.includes('resolve'))
            return Promise.resolve({
                ...base,
                stdout: JSON.stringify({
                    aliases: { 'javascript-typescript': 'javascript' },
                    extractors: { javascript: [{}] },
                }),
            });
        const cwd = options.cwd;
        invoked.push({ argv, cwd });
        if (argv.includes('analyze')) {
            const output = argv.find((part) => part.startsWith('--output='))!;
            writeFileSync(
                output.slice('--output='.length),
                JSON.stringify({
                    version: '2.1.0',
                    runs: [
                        {
                            results: [
                                {
                                    ruleId: 'js/sql-injection',
                                    message: { text: 'Planted injection' },
                                    locations: [
                                        {
                                            physicalLocation: {
                                                artifactLocation: {
                                                    uri: pathToFileURL(join(cwd, 'source file.ts')).href,
                                                },
                                                region: { startLine: 1, startColumn: 14 },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            );
        } else if (!argv.includes('create')) throw new Error('Unexpected CodeQL command');
        return Promise.resolve({ ...base, stdout: '' });
    });
    try {
        const findings = await codeql(
            engineInput(session, {
                scope: session.scopes.find((entry) => entry.scope.path === '')!,
                spec: spec,
                files: session.repository.files,
            }),
        );
        expect(invoked.map(({ cwd }) => cwd)).not.toContain(directory.path);
        const option = (command: string, prefix: string) =>
            invoked
                .filter(({ argv }) => argv.includes(command))
                .map(({ argv }) => argv.find((part) => part.startsWith(prefix)));
        expect(option('create', '--language=')).toStrictEqual(['--language=javascript']);
        expect(option('analyze', 'codeql/')).toStrictEqual([
            `codeql/javascript-queries@${packVersion}:codeql-suites/javascript-security-extended.qls`,
        ]);
        expect(findings).toMatchObject([
            { check: 'security/codeql', rule: 'js/sql-injection', file: 'source file.ts', line: 1, column: 14 },
        ]);
        expect(readFileSync(join(directory.path, 'source file.ts'), 'utf8')).toBe('export const source = true;\n');
    } finally {
        run.mockRestore();
    }
});
