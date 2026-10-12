import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import * as environment from '#cli/system/environment.ts';
import { buildFolder } from '#cli/checks/language/swift/build-folder.ts';
import { checkReport, buildRunOptions } from '#tests/setup/run-gspot.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { checkFindings, isolateCompilerCache } from '#tests/setup/check-input.ts';
import { coverageShortfalls, parseSwiftCoverage } from '#cli/checks/testing/swift-tests.ts';

import {
    XCTEST_SETTINGS,
    XCTEST_FAILURES,
    SKIP_REASON_CASES,
    SLEEP_SYNTAX_CASES,
    SWIFT_PACKAGE_COVERAGE_FILES,
    SWIFT_PACKAGE_COVERAGE_TARGETS,
} from '#tests/config/swift-tests.ts';

const SHEBANG = `#!${process.execPath}\n`;

test('the coverage check compares each named target with its limit', () => {
    const report = { targets: [{ name: 'App.app', lineCoverage: 0.617 }] };
    expect(
        coverageShortfalls(report, {
            lines: 0,
            target: [{ name: 'App', lines: 61, reason: 'Required target coverage.' }],
        }),
    ).toStrictEqual([]);
    expect(
        coverageShortfalls(report, {
            lines: 0,
            target: [{ name: 'App', lines: 62, reason: 'Required target coverage.' }],
        }),
    ).toStrictEqual(['App covers 61% of its lines, under the limit of 62%.']);
    expect(
        coverageShortfalls(report, {
            lines: 0,
            target: [{ name: 'Widget', lines: 10, reason: 'Required target coverage.' }],
        }),
    ).toStrictEqual(['The coverage report has no target named Widget.']);
});

test('the shared coverage limit applies to every source target without overriding a named limit', () => {
    const report = {
        targets: [
            { name: 'App', lineCoverage: 0.6 },
            { name: 'Library', lineCoverage: 0.75 },
        ],
    };
    expect(coverageShortfalls(report, { lines: 70, target: [] })).toStrictEqual([
        'App covers 60% of its lines, under the limit of 70%.',
    ]);
    expect(
        coverageShortfalls(report, {
            lines: 70,
            target: [{ name: 'App', lines: 60, reason: 'Required target coverage.' }],
        }),
    ).toStrictEqual([]);
    expect(coverageShortfalls(report, { lines: 0, target: [] })).toStrictEqual([]);
});
{
    const XCTEST_EXECUTION_OPTIONS = buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] });

    test.each([...XCTEST_FAILURES])(
        'XCTest coverage classifies $failure and passes after the fix',
        async ({ settings, build, coverage, code, status, produced, note }) => {
            using _system = spyOn(environment, 'currentOperatingSystem').mockReturnValue('macos');
            await using sandbox = await testdir();
            await using _cache = await isolateCompilerCache();
            await createFileTree(sandbox.path, {
                'gspot.toml': settings,
                'ExampleTests.swift': 'import XCTest\n',
                'Example.xcodeproj/project.pbxproj': '',
            });
            await fakeTool(sandbox.path, 'node_modules/.bin/xcodebuild', `${SHEBANG}${build}\n`);
            await fakeTool(
                sandbox.path,
                'node_modules/.bin/xcrun',
                `${SHEBANG}await Bun.write('viewed.txt', 'viewed'); console.log(${JSON.stringify(coverage === undefined ? '{}' : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: coverage }] }))});\n`,
            );
            const outcome = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
            expect(outcome.report.exitCode).toBe(code);
            expect(outcome.report.checks[0]!.status).toBe(status);
            if (note !== undefined) expect(outcome.report.checks[0]!.note).toContain(note);
            expect(await pathExists(join(sandbox.path, 'viewed.txt'))).toBe(false);
            const viewed = join(buildFolder(sandbox.path), 'swift/root/coverage/source/viewed.txt');
            // The build folder keeps the coverage view after the run produces it.
            expect((await pathExists(viewed)) ? await readFile(viewed, 'utf8') : undefined).toBe(
                produced ? 'viewed' : undefined,
            );
            await writeFile(join(sandbox.path, 'gspot.toml'), XCTEST_SETTINGS);
            await writeFile(join(sandbox.path, 'node_modules/.bin/xcodebuild.js'), `${SHEBANG}\n`);
            await writeFile(
                join(sandbox.path, 'node_modules/.bin/xcrun.js'),
                `${SHEBANG}console.log(${JSON.stringify(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }))});\n`,
            );
            const corrected = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([
                { check: 'swift-tests/coverage', status: 'passed', findings: [] },
            ]);
        },
    );

    test('XCTest coverage refuses an external result link and removes a previous result bundle', async () => {
        using _system = spyOn(environment, 'currentOperatingSystem').mockReturnValue('macos');
        await using sandbox = await testdir();
        await using outside = await testdir();
        await using _cache = await isolateCompilerCache();
        const cache = join(buildFolder(sandbox.path), 'swift/root/coverage');
        await createFileTree(sandbox.path, {
            'gspot.toml': XCTEST_SETTINGS,
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
        });
        await fakeTool(
            sandbox.path,
            'node_modules/.bin/xcodebuild',
            `${SHEBANG}const bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1]; if (await Bun.file(bundle + '/data/previous').exists()) throw new Error('Previous bundle survived'); await Bun.write('tested.txt', 'tested');\n`,
        );
        await fakeTool(
            sandbox.path,
            'node_modules/.bin/xcrun',
            `${SHEBANG}console.log(JSON.stringify({targets:[{name:'Example',lineCoverage:1}]}));\n`,
        );
        await writeFile(join(outside.path, 'authored.txt'), 'preserved');
        await mkdir(cache, { recursive: true });
        const bundle = join(cache, 'coverage.xcresult');
        await symlink(outside.path, bundle, 'dir');
        const refused = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
        expect(refused.report.exitCode).toBe(2);
        expect(refused.report.checks[0]?.note).toContain('is a link. gspot does not write through links.');
        expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
        expect(await pathExists(join(cache, 'source/tested.txt'))).toBe(false);
        await rm(bundle);
        await mkdir(join(bundle, 'data'), { recursive: true });
        await writeFile(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
        const corrected = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(await pathExists(bundle)).toBe(false);
        expect(await readFile(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
        expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    });
}

test('Swift Testing outside test folders reports a sleep and passes after the fix', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() async {\n    try await Task.sleep(for: .seconds(1))\n}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift-tests'], { level: 'all' }),
        'Examples/Checks.swift': source,
        'AppTests/Helper.swift': 'func waits() { sleep(1) }\n',
    });
    const command = ['check', '--only', 'swift-tests/sleep', '--json'];
    const broken = await checkReport(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks[0]!.findings).toStrictEqual([
        containing({ file: 'Examples/Checks.swift', rule: 'sleep', line: 3 }),
    ]);
    await Bun.write(
        `${sandbox.path}/Examples/Checks.swift`,
        source.replace('try await Task.sleep(for: .seconds(1))', '#expect(true)'),
    );
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'swift-tests/sleep', status: 'passed', findings: [] }]);
});

test.each([...SKIP_REASON_CASES])('Swift skip reason belongs to its argument: $body', async ({ body, missing }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift-tests']),
        'Examples/Checks.swift': `import Testing\nfunc checks() throws {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await checkFindings(session.root, 'swift-tests/skip-reasons');
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual(
        missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : [],
    );
});

test.each([...SLEEP_SYNTAX_CASES])('swift-tests/sleep reads Swift syntax: $body', async ({ body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift-tests'], { level: 'all' }),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await checkFindings(session.root, 'swift-tests/sleep');
    expect(findings).toHaveLength(count);
    if (count > 0) expect(findings[0]).toMatchObject({ file: 'Examples/Checks.swift', line: 3 });
});

test('Swift package coverage measures actual custom target paths and applies every target limit', async () => {
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
    expect(coverageShortfalls(report, { lines: 70, target: [] })).toStrictEqual([
        'Core covers 50% of its lines, under the limit of 70%.',
        'API covers 66% of its lines, under the limit of 70%.',
    ]);
    expect(
        coverageShortfalls(report, {
            lines: 70,
            target: [{ name: 'API', lines: 66, reason: 'Required target coverage.' }],
        }),
    ).toStrictEqual(['Core covers 50% of its lines, under the limit of 70%.']);
    expect(
        coverageShortfalls(report, {
            lines: 50,
            target: [{ name: 'API', lines: 66, reason: 'Required target coverage.' }],
        }),
    ).toStrictEqual([]);
    const omitted = JSON.stringify({
        data: [{ files: files.filter(({ filename }) => !filename.endsWith('API.swift')) }],
    });
    expect(() => parseSwiftCoverage(omitted, description, sandbox.path)).toThrow(
        'The Swift coverage report has no source lines for target API.',
    );
});
