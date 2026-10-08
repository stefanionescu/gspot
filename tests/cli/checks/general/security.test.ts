import { pathToFileURL } from 'node:url';
import { sep, join, resolve } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { applyIgnores } from '#cli/execution/run.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { codeql } from '#cli/checks/general/security.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildCheckInput } from '#tests/harness/input.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { sarifFindings } from '#cli/parsers/output/sarif.ts';
import type { CapturedInvocation } from '#tests/types/harness/command.ts';

import {
    CODEQL_REPORT,
    CYCLIC_REPORT,
    ENCODED_REPORT,
    JAVASCRIPT_LANGUAGES,
} from '#tests/config/cli/checks/general/security.ts';

const sourceRoot = resolve('selected-source');
const sourceUri = pathToFileURL(`${sourceRoot}${sep}`).href;

test('sarifFindings maps every result to its file and line', () => {
    const findings = sarifFindings(CODEQL_REPORT, 'security/codeql', 'Correct the defect.', sourceRoot);
    expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
        ['api/src/users.ts', 12, 'js/sql-injection'],
        ['scripts/build.ts', undefined, 'js/path-injection'],
    ]);
});

test.each([
    {},
    { version: '2.1.0' },
    { version: '2.1.0', runs: [] },
    { version: '2.1.0', runs: [{}] },
    { version: '2.1.0', runs: [{ results: null }] },
])('an incomplete CodeQL report cannot become a clean result: %j', (value) => {
    expect(() => sarifFindings(value, 'security/codeql', 'Correct the defect.', sourceRoot)).toThrow('runs');
});

test('a valid CodeQL report with no results remains clean', () => {
    expect(
        sarifFindings(
            { version: '2.1.0', runs: [{ results: [] }] },
            'security/codeql',
            'Correct the defect.',
            sourceRoot,
        ),
    ).toStrictEqual([]);
});

test.each([
    { executionSuccessful: false },
    { executionSuccessful: true, toolExecutionNotifications: [{ level: 'error' }] },
])('CodeQL invocation failures cannot become clean results: %j', (invocation) => {
    expect(() =>
        sarifFindings(
            { version: '2.1.0', runs: [{ results: [], invocations: [invocation] }] },
            'security/codeql',
            'Correct the defect.',
            sourceRoot,
        ),
    ).toThrow('unsuccessful analysis');
});

test.each([
    { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' },
    { uri: new URL('api/some%20file.ts', sourceUri).href },
    { uri: 'some%20file.ts', uriBaseId: 'API' },
    { index: 0 },
])('CodeQL resolves source locations before applying path-specific exceptions: %j', (artifact) => {
    const report = {
        version: '2.1.0',
        runs: [
            {
                originalUriBaseIds: {
                    ROOT: { uri: sourceUri },
                    API: { uri: 'api/', uriBaseId: 'ROOT' },
                },
                artifacts: [{ location: { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' } }],
                results: [
                    {
                        ruleId: 'js/sql-injection',
                        message: { text: 'Test injection' },
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: artifact,
                                    region: { startLine: 9, startColumn: 4 },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };
    expect(sarifFindings(report, 'security/codeql', 'Correct the defect.', sourceRoot)).toMatchObject([
        { file: 'api/some file.ts', line: 9, column: 4, rule: 'js/sql-injection' },
    ]);
});

test.each([
    { uri: '../outside.ts' },
    { uri: pathToFileURL(resolve(sourceRoot, '../outside.ts')).href },
    { uri: 'https://example.com/file.ts' },
    { uri: 'file.ts', uriBaseId: 'missing' },
    { index: 1 },
])('CodeQL refuses unresolved or external report locations: %j', (artifact) => {
    const report = {
        version: '2.1.0',
        runs: [{ results: [{ locations: [{ physicalLocation: { artifactLocation: artifact } }] }] }],
    };
    expect(() => sarifFindings(report, 'security/codeql', 'Correct the defect.', sourceRoot)).toThrow('SARIF reported');
});

test('CodeQL rejects cyclic URI bases before resolving a finding', () => {
    expect(() => sarifFindings(CYCLIC_REPORT, 'security/codeql', 'Correct the defect.', sourceRoot)).toThrow(
        'SARIF reported a cyclic source location.',
    );
});

test.each([
    { name: 'no region', region: undefined },
    { name: 'negative offset', region: { charOffset: -1 } },
    { name: 'large offset', region: { charOffset: 1000 } },
])('SARIF $name is file-only without reading a missing encoded source', ({ region }) => {
    const report = {
        version: '2.1.0',
        runs: [
            {
                defaultEncoding: 'unsupported-encoding',
                columnKind: 'unicodeCodePoints',
                newlineSequences: ['\r\n'],
                artifacts: [{ location: { uri: 'missing.py' }, encoding: 'unsupported-encoding' }],
                results: [{ locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region } }] }],
            },
        ],
    };
    const [finding] = sarifFindings(report, 'security/codeql', 'Correct the defect.', sourceRoot);
    expect(finding).toMatchObject({ file: 'missing.py', fixable: false });
    expect(finding).not.toHaveProperty('line');
    expect(finding).not.toHaveProperty('column');
});

test('SARIF preserves explicit positions without reading source bytes or declared encodings', async () => {
    await using directory = await testdir();
    const source = Buffer.from('first\n😀x', 'utf16le');
    await createFileTree(directory.path, { 'source.py': source });
    expect(sarifFindings(ENCODED_REPORT, 'security/codeql', 'Correct the defect.', directory.path)).toMatchObject([
        { file: 'source.py', line: 3, column: 2 },
    ]);
    expect(await readFile(join(directory.path, 'source.py'))).toStrictEqual(source);
});

test('SARIF retains a repository-level finding with no invented source coordinates', () => {
    const report = { version: '2.1.0', runs: [{ results: [{}] }] };
    const [finding] = sarifFindings(report, 'security/codeql', 'Correct the defect.', sourceRoot);
    expect(finding).toMatchObject({ file: '', fixable: false });
    expect(finding).not.toHaveProperty('line');
    expect(finding).not.toHaveProperty('column');
});

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
    const input = buildCheckInput(session, 'security/codeql');
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
            sources.push(await readFile(join(cwd, 'source.py'), 'utf8'));
            await writeFile(join(cwd, 'generated.py'), 'build side effect');
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
        expect(await codeql(buildCheckInput(corrected, 'security/codeql'))).toStrictEqual([]);
        expect(copies).not.toContain(directory.path);
        expect(sources).toStrictEqual(['value = 1\n']);
        expect(await pathExists(join(directory.path, 'generated.py'))).toBe(false);
    } finally {
        run.mockRestore();
    }
    return copies;
}

// Aliases resolve to one native language and its pinned pack; SARIF locations map back from the copy.
async function mapsIsolatedLocations(policy: string): Promise<Finding[]> {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'source file.ts': 'export const source = true;\n',
    });
    const session = await openSession(directory.path);
    const manifest = session.manifests.get('security')!;
    const packVersion = manifest.tools.find((tool) => tool.name === 'codeql')!.query_packs!['javascript'];
    // Every database creation and analysis the check ran, with the copy it ran in.
    const invoked: CapturedInvocation[] = [];
    const run = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
        const base = { code: 0, missing: false, stderr: '', duration: 1 };
        if (argv.includes('resolve'))
            return {
                ...base,
                stdout: JAVASCRIPT_LANGUAGES,
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
    try {
        const findings = await codeql(buildCheckInput(session, 'security/codeql'));
        expect(invoked.map(({ cwd }) => cwd)).not.toContain(directory.path);
        expectNativeCodeqlOptions(
            invoked.map(({ argv }) => argv),
            packVersion!,
        );
        expect(await readFile(join(directory.path, 'source file.ts'), 'utf8')).toBe('export const source = true;\n');
        return applyIgnores(findings, session.policyFiles.policy.ignore).kept;
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
            expect(await Promise.all(copies.map((copy) => pathExists(copy)))).toStrictEqual(copies.map(() => false));
        },
    );
    test.each([
        ['matching rule and path', 'js/sql-injection', ['source file.ts'], 0],
        ['different rule', 'js/other', ['source file.ts'], 1],
        ['different path', 'js/sql-injection', ['elsewhere/**'], 1],
    ] as const)('CodeQL policy ignores require %s', async (_name, rule, paths, count) => {
        const policy = `${ALIASED_POLICY}\n[[ignore]]\ncheck="security/codeql"\nrule=${JSON.stringify(rule)}\npaths=${JSON.stringify(paths)}\nreason="Reviewed analysis case."\n`;
        expect(await mapsIsolatedLocations(policy)).toHaveLength(count);
    });
    test('CodeQL adapter uses native language names and pinned packs once and maps isolated SARIF locations', async () => {
        expect(await mapsIsolatedLocations(ALIASED_POLICY)).toMatchObject([
            { check: 'security/codeql', rule: 'js/sql-injection', file: 'source file.ts', line: 1, column: 14 },
        ]);
    });
});
