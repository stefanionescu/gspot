import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { coverageShortfalls } from '#cli/checks/tool/xctest.ts';
import { parseSwiftCoverage } from '#cli/parsers/swift/coverage.ts';
import { SWIFT_PACKAGE_COVERAGE_FILES, SWIFT_PACKAGE_COVERAGE_TARGETS } from '#tests/config/cli/parsers/swift.ts';

test('Swift package coverage measures actual custom target paths and applies every target floor', async () => {
    await using sandbox = await testdir();
    const files = SWIFT_PACKAGE_COVERAGE_FILES.map((file) => ({
        ...file,
        filename: join(sandbox.path, file.filename),
    }));
    const text = JSON.stringify({ data: [{ files }] });
    const description = JSON.stringify({ targets: SWIFT_PACKAGE_COVERAGE_TARGETS });
    const report = parseSwiftCoverage(text, description, sandbox.path);
    expect(report).toStrictEqual({
        targets: [
            { name: 'Core', lineCoverage: 0.5 },
            { name: 'API', lineCoverage: 2 / 3 },
        ],
    });
    expect(coverageShortfalls(report, { lines: 70, overrides: [] })).toStrictEqual([
        'Core covers 50% of its lines, under the floor of 70%.',
        'API covers 66% of its lines, under the floor of 70%.',
    ]);
    expect(coverageShortfalls(report, { lines: 70, overrides: [{ target: 'API', percent: 66 }] })).toStrictEqual([
        'Core covers 50% of its lines, under the floor of 70%.',
    ]);
    expect(coverageShortfalls(report, { lines: 50, overrides: [{ target: 'API', percent: 66 }] })).toStrictEqual([]);
    const omitted = JSON.stringify({
        data: [{ files: files.filter(({ filename }) => !filename.endsWith('API.swift')) }],
    });
    expect(() => parseSwiftCoverage(omitted, description, sandbox.path)).toThrow(
        'The Swift coverage report has no source lines for target API.',
    );
});
