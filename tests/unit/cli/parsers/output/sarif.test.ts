import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { sep, join, resolve } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { parseOutput, outputSchema } from '#cli/parsers/output/formats.ts';

import {
    CODEQL_REPORT,
    CYCLIC_REPORT,
    ENCODED_REPORT,
    FAILED_INVOCATIONS,
    POSITIONLESS_REGIONS,
} from '#tests/config/security.ts';

const sourceRoot = resolve('selected-source');

const sourceUri = pathToFileURL(`${sourceRoot}${sep}`).href;

test('sarifFindings maps every result to its file and line', () => {
    const findings = parseOutput(
        { name: 'docker/trivy-config', help: 'Correct the defect.', output: outputSchema.parse({ format: 'sarif' }) },
        JSON.stringify(CODEQL_REPORT),
        '',
        { root: sourceRoot, cwd: sourceRoot },
    );
    expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
        ['api/src/users.ts', 12, 'js/sql-injection'],
        ['scripts/build.ts', undefined, 'js/path-injection'],
    ]);
});

test.each([...FAILED_INVOCATIONS])(
    'a failed CodeQL run in the report is an error, not a clean result: %j',
    (invocation) => {
        expect(() =>
            parseOutput(
                {
                    name: 'docker/trivy-config',
                    help: 'Correct the defect.',
                    output: outputSchema.parse({ format: 'sarif' }),
                },
                JSON.stringify({ version: '2.1.0', runs: [{ results: [], invocations: [invocation] }] }),
                '',
                { root: sourceRoot, cwd: sourceRoot },
            ),
        ).toThrow('unsuccessful analysis');
    },
);

test.each([
    { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' },
    { uri: new URL('api/some%20file.ts', sourceUri).href },
    { uri: 'some%20file.ts', uriBaseId: 'API' },
    { index: 0 },
])('source locations become repository paths before path ignores apply: %j', (artifact) => {
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
    expect(
        parseOutput(
            {
                name: 'docker/trivy-config',
                help: 'Correct the defect.',
                output: outputSchema.parse({ format: 'sarif' }),
            },
            JSON.stringify(report),
            '',
            { root: sourceRoot, cwd: sourceRoot },
        ),
    ).toMatchObject([{ file: 'api/some file.ts', line: 9, column: 4, rule: 'js/sql-injection' }]);
});

test.each([
    { uri: '../outside.ts' },
    { uri: pathToFileURL(resolve(sourceRoot, '../outside.ts')).href },
    { uri: 'https://example.com/file.ts' },
    { uri: 'file.ts', uriBaseId: 'missing' },
    { index: 1 },
])('unresolved or external report locations are refused: %j', (artifact) => {
    const report = {
        version: '2.1.0',
        runs: [{ results: [{ locations: [{ physicalLocation: { artifactLocation: artifact } }] }] }],
    };
    expect(() =>
        parseOutput(
            {
                name: 'docker/trivy-config',
                help: 'Correct the defect.',
                output: outputSchema.parse({ format: 'sarif' }),
            },
            JSON.stringify(report),
            '',
            { root: sourceRoot, cwd: sourceRoot },
        ),
    ).toThrow('SARIF reported');
});

test('cyclic URI bases are refused before a finding resolves', () => {
    expect(() =>
        parseOutput(
            {
                name: 'docker/trivy-config',
                help: 'Correct the defect.',
                output: outputSchema.parse({ format: 'sarif' }),
            },
            JSON.stringify(CYCLIC_REPORT),
            '',
            { root: sourceRoot, cwd: sourceRoot },
        ),
    ).toThrow('SARIF reported a cyclic source location.');
});

test.each([...POSITIONLESS_REGIONS])(
    'a result with $name has a file only and reads no missing source',
    ({ region }) => {
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
        const [finding] = parseOutput(
            {
                name: 'docker/trivy-config',
                help: 'Correct the defect.',
                output: outputSchema.parse({ format: 'sarif' }),
            },
            JSON.stringify(report),
            '',
            { root: sourceRoot, cwd: sourceRoot },
        );
        expect(finding).toMatchObject({ file: 'missing.py', fixable: false });
        expect(finding).not.toHaveProperty('line');
        expect(finding).not.toHaveProperty('column');
    },
);

test('given positions are kept without reading source bytes or encodings', async () => {
    await using directory = await testdir();
    const source = Buffer.from('first\n😀x', 'utf16le');
    await createFileTree(directory.path, { 'source.py': source });
    expect(
        parseOutput(
            {
                name: 'docker/trivy-config',
                help: 'Correct the defect.',
                output: outputSchema.parse({ format: 'sarif' }),
            },
            JSON.stringify(ENCODED_REPORT),
            '',
            { root: directory.path, cwd: directory.path },
        ),
    ).toMatchObject([{ file: 'source.py', line: 3, column: 2 }]);
    expect(await readFile(join(directory.path, 'source.py'))).toStrictEqual(source);
});

test('a result with no location is a repository-level finding without line or column', () => {
    const report = { version: '2.1.0', runs: [{ results: [{}] }] };
    const [finding] = parseOutput(
        { name: 'docker/trivy-config', help: 'Correct the defect.', output: outputSchema.parse({ format: 'sarif' }) },
        JSON.stringify(report),
        '',
        { root: sourceRoot, cwd: sourceRoot },
    );
    expect(finding).toMatchObject({ file: '', fixable: false });
    expect(finding).not.toHaveProperty('line');
    expect(finding).not.toHaveProperty('column');
});
