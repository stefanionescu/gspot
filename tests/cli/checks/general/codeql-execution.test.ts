import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildEngineInput } from '#tests/harness/input.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { codeql } from '#cli/checks/general/security/codeql.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { CapturedInvocation } from '#tests/types/harness/command.ts';
import { JAVASCRIPT_LANGUAGES } from '#tests/config/cli/checks/general/codeql-execution.ts';

const ALIASED_POLICY = buildPolicy(['security'], {
    tables: '[tools.codeql]\nlanguages = ["javascript-typescript", "javascript"]\n',
    level: 'all',
});

// Aliases resolve to one native language and its exact query-pack version.
function expectNativeCodeqlOptions(commands: string[][], packVersion: string): void {
    const option = (command: string, prefix: string) =>
        commands.filter((argv) => argv.includes(command)).map((argv) => argv.find((part) => part.startsWith(prefix)));
    expect(option('create', '--language=')).toStrictEqual(['--language=javascript']);
    expect(option('analyze', 'codeql/')).toStrictEqual([
        `codeql/javascript-queries@${packVersion}:codeql-suites/javascript-security-extended.qls`,
    ]);
}

// A language that names a path is refused before any process runs; a real language runs in a copy.
async function refusesOutsideLanguage(language: string): Promise<string[]> {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['security'], {
            tables: `[tools.codeql]\nlanguages = [${JSON.stringify(language)}]\n`,
            level: 'all',
        }),
        'source.py': 'value = 1\n',
    });
    const session = await openSession(directory.path);
    const spec = session.manifests.get('security')!.checks.find((entry) => entry.name === 'security/codeql')!;
    const input = buildEngineInput(session, spec.name);
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
        await Bun.write(
            join(directory.path, 'gspot.toml'),
            buildPolicy(['security'], { tables: '[tools.codeql]\nlanguages = ["python"]\n', level: 'all' }),
        );
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
        expect(copies).not.toContain(directory.path);
        expect(sources).toStrictEqual(['value = 1\n']);
        expect(existsSync(join(directory.path, 'generated.py'))).toBe(false);
    } finally {
        run.mockRestore();
    }
    return copies;
}

// Aliases resolve to one native language and its pinned pack; SARIF locations map back from the copy.
async function mapsIsolatedLocations(): Promise<Finding[]> {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': ALIASED_POLICY,
        'source file.ts': 'export const source = true;\n',
    });
    const session = await openSession(directory.path);
    const manifest = session.manifests.get('security')!;
    const spec = manifest.checks.find((entry) => entry.name === 'security/codeql')!;
    const packVersion = manifest.tools.find((tool) => tool.name === 'codeql')!.query_packs!['javascript'];
    // Every database creation and analysis the check ran, with the copy it ran in.
    const invoked: CapturedInvocation[] = [];
    const run = spyOn(processes, 'run').mockImplementation((argv, options) => {
        const base = { code: 0, missing: false, stderr: '', duration: 1 };
        if (argv.includes('resolve'))
            return Promise.resolve({
                ...base,
                stdout: JAVASCRIPT_LANGUAGES,
            });
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
            writeFileSync(
                output.slice('--output='.length),
                JSON.stringify({ version: '2.1.0', runs: [{ results: [result] }] }),
            );
        } else if (!argv.includes('create')) throw new Error('Unexpected CodeQL command');
        return Promise.resolve({ ...base, stdout: '' });
    });
    try {
        const findings = await codeql(buildEngineInput(session, spec.name));
        expect(invoked.map(({ cwd }) => cwd)).not.toContain(directory.path);
        expectNativeCodeqlOptions(
            invoked.map(({ argv }) => argv),
            packVersion!,
        );
        expect(readFileSync(join(directory.path, 'source file.ts'), 'utf8')).toBe('export const source = true;\n');
        return findings;
    } finally {
        run.mockRestore();
    }
}

// CodeQL ships no arm64 Linux build; its pin says where it runs.
describe.if(hasToolBuild('codeql'))('the CodeQL adapter', () => {
    test.each(['../outside', 'C:outside'])(
        'CodeQL refuses output language %s before spawning and accepts a corrected language',
        async (language) => {
            const copies = await refusesOutsideLanguage(language);
            expect(copies.every((copy) => !existsSync(copy))).toBe(true);
        },
    );
    test('CodeQL adapter uses native language names and pinned packs once and maps isolated SARIF locations', async () => {
        expect(await mapsIsolatedLocations()).toMatchObject([
            { check: 'security/codeql', rule: 'js/sql-injection', file: 'source file.ts', line: 1, column: 14 },
        ]);
    });
});
