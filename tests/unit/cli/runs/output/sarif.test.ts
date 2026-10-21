import { test, expect } from 'bun:test';
import { sep, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { type SarifLog } from '#cli/types/runs/tool-reports.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';

import {
    CODEQL_REPORT,
    CYCLIC_REPORT,
    ENCODED_REPORT,
    FAILED_ANALYSES,
    POSITIONLESS_RESULTS,
} from '#tests/data/runs/output.ts';

/** Parse a Static Analysis Results Interchange Format (SARIF) report with the same check and paths for each case. */
function parseSarifReport(report: unknown, root: string): Finding[] {
    return parseOutput(
        {
            runs: 'files',
            name: 'docker/trivy-config',
            help: 'Correct the defect.',
            output: outputSchema.parse({ format: 'sarif' }),
        },
        JSON.stringify(report),
        '',
        { root, cwd: root },
    );
}

/** A report with one result at the given artifact location. */
function buildLocationReport(artifactLocation: Record<string, unknown>): SarifLog {
    return { version: '2.1.0', runs: [{ results: [{ locations: [{ physicalLocation: { artifactLocation } }] }] }] };
}

test('sarifFindings maps every result to its file and line', () => {
    const sourceRoot = resolve('selected-source');

    const findings = parseSarifReport(CODEQL_REPORT, sourceRoot);
    expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
        ['api/src/users.ts', 12, 'js/sql-injection'],
        ['scripts/build.ts', undefined, 'js/path-injection'],
    ]);
});

test.each([...FAILED_ANALYSES])(
    'a failed CodeQL run in the report is an error, not a clean result: %j',
    (invocation) => {
        const sourceRoot = resolve('selected-source');

        expect(() =>
            parseSarifReport({ version: '2.1.0', runs: [{ results: [], invocations: [invocation] }] }, sourceRoot),
        ).toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'output' }));
    },
);

test.each([
    { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' },
    { uri: new URL('api/some%20file.ts', pathToFileURL(`${resolve('selected-source')}${sep}`).href).href },
    { uri: 'some%20file.ts', uriBaseId: 'API' },
    { index: 0 },
])('source locations become repository paths before path ignores apply: %j', (artifact) => {
    const sourceRoot = resolve('selected-source');
    const sourceUri = pathToFileURL(`${sourceRoot}${sep}`).href;

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
    expect(parseSarifReport(report, sourceRoot)).toMatchObject([
        { file: 'api/some file.ts', line: 9, column: 4, rule: 'js/sql-injection' },
    ]);
});

test.each([
    { name: 'a path outside the root', report: buildLocationReport({ uri: '../outside.ts' }) },
    {
        name: 'a file URL outside the root',
        report: buildLocationReport({ uri: pathToFileURL(resolve(resolve('selected-source'), '../outside.ts')).href }),
    },
    { name: 'a web address', report: buildLocationReport({ uri: 'https://example.com/file.ts' }) },
    { name: 'an unknown URI base', report: buildLocationReport({ uri: 'file.ts', uriBaseId: 'missing' }) },
    { name: 'a missing artifact', report: buildLocationReport({ index: 1 }) },
    { name: 'a cyclic URI base', report: CYCLIC_REPORT },
])('a report location that gspot cannot resolve is refused: $name', ({ report }) => {
    expect(() => parseSarifReport(report, resolve('selected-source'))).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'output' }),
    );
});

test.each([...POSITIONLESS_RESULTS])(
    'a result with $name keeps no line or column and reads no missing source',
    ({ file, locations }) => {
        const sourceRoot = resolve('selected-source');

        const report = {
            version: '2.1.0',
            runs: [
                {
                    defaultEncoding: 'unsupported-encoding',
                    columnKind: 'unicodeCodePoints',
                    newlineSequences: ['\r\n'],
                    artifacts: [{ location: { uri: 'missing.py' }, encoding: 'unsupported-encoding' }],
                    results: [{ locations }],
                },
            ],
        };
        const [finding] = parseSarifReport(report, sourceRoot);
        expect(finding).toMatchObject({ file, fixable: false });
        expect(finding).not.toHaveProperty('line');
        expect(finding).not.toHaveProperty('column');
    },
);

test('given positions are kept without reading source bytes or encodings', async () => {
    await using folder = await testdir();
    const source = Buffer.from('first\n😀x', 'utf16le');
    await createFileTree(folder.path, { 'source.py': source });
    expect(parseSarifReport(ENCODED_REPORT, folder.path)).toMatchObject([{ file: 'source.py', line: 3, column: 2 }]);
});
