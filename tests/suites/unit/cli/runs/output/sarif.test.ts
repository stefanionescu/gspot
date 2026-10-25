import { test, expect } from 'bun:test';
import { sep, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { type SarifLog } from '#cli/types/runs/output/reports.ts';
import { outputSchema } from '#cli/schemas/configurations/output.ts';

import {
    CYCLIC_REPORT,
    CODEQL_REPORT,
    ENCODED_REPORT,
    FAILED_ANALYSES,
    SARIF_LOCATION_CASES,
    POSITIONLESS_RESULTS,
} from '#tests/config/runs/output/sarif.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 6 calls in this file share it.
function parseSarifReport(report: unknown, root: string): Finding[] {
    return parseOutput(
        {
            runs: 'files',
            id: 'docker/trivy-config',
            help: 'Correct the defect.',
            output: outputSchema.parse({ format: 'sarif' }),
        },
        JSON.stringify(report),
        '',
        { root, cwd: root },
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 5 calls in this file share it.
function buildLocationReport(artifactLocation: Record<string, unknown>): SarifLog {
    return { version: '2.1.0', runs: [{ results: [{ locations: [{ physicalLocation: { artifactLocation } }] }] }] };
}

test('a SARIF report maps every result to its file, line, and rule', () => {
    const sourceRoot = resolve('selected-source');

    const findings = parseSarifReport(CODEQL_REPORT, sourceRoot);
    expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
        ['api/src/users.ts', 12, 'js/sql-injection'],
        ['scripts/build.ts', undefined, 'js/path-injection'],
    ]);
});

test.each([...FAILED_ANALYSES])('a failed CodeQL run in the report is an error, not a clean result: %j', (analysis) => {
    const sourceRoot = resolve('selected-source');

    expect(() =>
        parseSarifReport({ version: '2.1.0', runs: [{ results: [], invocations: [analysis] }] }, sourceRoot),
    ).toThrow(new Error('SARIF reported an unsuccessful analysis.'));
});

test.each([...SARIF_LOCATION_CASES])(
    'source locations become repository paths before path ignores apply: %j',
    (artifact) => {
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
    },
);

const outsideLocation = { uri: pathToFileURL(resolve(resolve('selected-source'), '../outside.ts')).href };
const findings = [
    {
        name: 'a path outside the root',
        message: 'SARIF reported a source location outside the copy of the source.',
        report: buildLocationReport({ uri: '../outside.ts' }),
    },
    {
        name: 'a file URL outside the root',
        message: 'SARIF reported a source location outside the copy of the source.',
        report: buildLocationReport(outsideLocation),
    },
    {
        name: 'a web address',
        message: 'SARIF reported a source location that is not a file.',
        report: buildLocationReport({ uri: 'https://example.com/file.ts' }),
    },
    {
        name: 'an unknown URI base',
        message: 'SARIF reported an unknown source location: missing.',
        report: buildLocationReport({ uri: 'file.ts', uriBaseId: 'missing' }),
    },
    {
        name: 'a missing artifact',
        message: 'SARIF reported a missing artifact location.',
        report: buildLocationReport({ index: 1 }),
    },
    { name: 'a cyclic URI base', message: 'SARIF reported a cyclic source location.', report: CYCLIC_REPORT },
];
test.each(findings)('a report location that gspot cannot resolve is refused: $name', ({ report, message }) => {
    expect(() => parseSarifReport(report, resolve('selected-source'))).toThrow(new Error(message));
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
    await using sandbox = await testdir();
    const source = Buffer.from('first\n😀x', 'utf16le');
    await createFileTree(sandbox.path, { 'source.py': source });
    expect(parseSarifReport(ENCODED_REPORT, sandbox.path)).toMatchObject([{ file: 'source.py', line: 3, column: 2 }]);
});
