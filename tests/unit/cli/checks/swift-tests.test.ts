import { join } from 'node:path';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as environment from '#cli/system/environment.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildPlan } from '#cli/checks/language/swift/cache.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { checkFindings, buildCheckInput, createCompilerCache } from '#tests/setup/check-input.ts';

import {
    XCTEST_FAILURES,
    XCTEST_SETTINGS,
    SKIP_REASON_CASES,
    SWIFT_PACKAGE_COVERAGE_FILES,
    SWIFT_TARGET_COVERAGE_REPORT,
    SWIFT_PACKAGE_COVERAGE_TARGETS,
} from '#tests/data/checks/swift-tests.ts';

test.each([
    {
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        lines: 0,
        target: [{ name: 'App', lines: 61, reason: 'Required target coverage.' }],
        expected: [],
    },
    {
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        lines: 0,
        target: [{ name: 'App', lines: 62, reason: 'Required target coverage.' }],
        expected: ['App covers 61% of its lines, under the limit of 62%.'],
    },
    {
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        lines: 0,
        target: [{ name: 'Widget', lines: 10, reason: 'Required target coverage.' }],
        expected: ['The coverage report has no target named Widget.'],
    },
    {
        report: SWIFT_TARGET_COVERAGE_REPORT,
        lines: 70,
        target: [],
        expected: ['App covers 60% of its lines, under the limit of 70%.'],
    },
    {
        report: SWIFT_TARGET_COVERAGE_REPORT,
        lines: 70,
        target: [{ name: 'App', lines: 60, reason: 'Required target coverage.' }],
        expected: [],
    },
    {
        report: SWIFT_TARGET_COVERAGE_REPORT,
        lines: 0,
        target: [],
        expected: [],
    },
])(
    'the coverage check applies shared and named target limits: $expected',
    async ({ report, lines, target, expected }) => {
        using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
        await using sandbox = await testdir();
        await using _cache = await createCompilerCache();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['swift-tests', 'xcode'], {
                tables: `[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\n[coverage]\nlines = ${String(lines)}\nswift_target = ${JSON.stringify(target).replaceAll(':', ' = ')}\n`,
            }),
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
        });
        await fakeTool(sandbox.path, 'node_modules/.bin/xcodebuild', `#!${process.execPath}\n`);
        await fakeTool(
            sandbox.path,
            'node_modules/.bin/xcrun',
            `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(report))});\n`,
        );
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
        );
        expect(
            result.report.checks[0]?.findings.map((finding) => finding.message),
            JSON.stringify(result.report),
        ).toStrictEqual([...expected]);
        expect(result.report.exitCode).toBe(expected.length === 0 ? 0 : 1);
    },
);

test.each([...XCTEST_FAILURES])(
    'swift-tests: XCTest coverage classifies $failure and passes after the fix',
    async ({ settings, build, coverage, code, status, produced, note }) => {
        using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
        await using sandbox = await testdir();
        await using _cache = await createCompilerCache();
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
        });
        await fakeTool(sandbox.path, 'node_modules/.bin/xcodebuild', `#!${process.execPath}\n${build}\n`);
        await fakeTool(
            sandbox.path,
            'node_modules/.bin/xcrun',
            `#!${process.execPath}\nawait Bun.write('viewed.txt', 'viewed'); console.log(${JSON.stringify(coverage === undefined ? '{}' : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: coverage }] }))});\n`,
        );
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
        );
        expect(result.report.exitCode).toBe(code);
        expect(result.report.checks[0]!.status).toBe(status);
        if (note !== undefined) expect(result.report.checks[0]!.note).toContain(note);
        expect(await isOnDisk(join(sandbox.path, 'viewed.txt'))).toBe(false);
        await writeFile(join(sandbox.path, 'gspot.toml'), XCTEST_SETTINGS);
        const viewed = join(
            buildPlan(buildCheckInput(await openSession(sandbox.path), 'swift-tests/coverage'), {
                purpose: 'coverage',
            }).folder,
            'source/viewed.txt',
        );
        // The build folder keeps the coverage view after the run produces it.
        expect((await isOnDisk(viewed)) ? await readFile(viewed, 'utf8') : undefined).toBe(
            produced ? 'viewed' : undefined,
        );
        await writeFile(join(sandbox.path, 'node_modules/.bin/xcodebuild.js'), `#!${process.execPath}\n\n`);
        await writeFile(
            join(sandbox.path, 'node_modules/.bin/xcrun.js'),
            `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }))});\n`,
        );
        const corrected = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
        );
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: 'swift-tests/coverage', status: 'passed', findings: [] },
        ]);
    },
);

test('swift-tests: XCTest coverage refuses an external result link and removes a previous result bundle', async () => {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await createCompilerCache();
    await createFileTree(sandbox.path, {
        'gspot.toml': XCTEST_SETTINGS,
        'ExampleTests.swift': 'import XCTest\n',
        'Example.xcodeproj/project.pbxproj': '',
    });
    await fakeTool(
        sandbox.path,
        'node_modules/.bin/xcodebuild',
        `#!${process.execPath}\nconst bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1]; if (await Bun.file(bundle + '/data/previous').exists()) throw new Error('Previous bundle survived'); await Bun.write('tested.txt', 'tested');\n`,
    );
    await fakeTool(
        sandbox.path,
        'node_modules/.bin/xcrun',
        `#!${process.execPath}\nconsole.log(JSON.stringify({targets:[{name:'Example',lineCoverage:1}]}));\n`,
    );
    const cache = buildPlan(buildCheckInput(await openSession(sandbox.path), 'swift-tests/coverage'), {
        purpose: 'coverage',
    }).folder;
    await writeFile(join(outside.path, 'authored.txt'), 'preserved');
    await mkdir(cache, { recursive: true });
    const bundle = join(cache, 'coverage.xcresult');
    await symlink(outside.path, bundle, 'dir');
    const refused = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
    );
    expect(refused.report.exitCode).toBe(2);
    expect(refused.report.checks[0]?.note).toContain('is a link. gspot does not write through links.');
    expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    expect(await isOnDisk(join(cache, 'source/tested.txt'))).toBe(false);
    await rm(bundle);
    await mkdir(join(bundle, 'data'), { recursive: true });
    await writeFile(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
    );
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(await isOnDisk(bundle)).toBe(false);
    expect(await readFile(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
    expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
});

test.each([...SKIP_REASON_CASES])('Swift skip reason belongs to its argument: $body', async ({ body, missing }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['swift-tests']),
        'Examples/Checks.swift': `import Testing\nfunc checks() throws {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await checkFindings(session.root, 'swift-tests/skip-reasons');
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual(
        missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : [],
    );
});

test('Swift package coverage measures actual custom target paths and applies every target limit', async () => {
    using _system = spyOn(environment, 'getOperatingSystem').mockReturnValue('macos');
    await using sandbox = await testdir();
    await using _cache = await createCompilerCache();
    const reportPath = join(sandbox.path, 'coverage-input.json');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['swift-tests'], {
            tables: '[coverage]\nlines = 0\n[[coverage.swift_target]]\nname = "Core"\nlines = 51\n[[coverage.swift_target]]\nname = "API"\nlines = 67\n',
        }),
        'Package.swift': '// swift-tools-version: 6.0\nimport PackageDescription\n',
        'Custom/Core/First.swift': 'func first() -> Int { 1 }\n',
        'Custom/Core/Second.swift': 'func second() -> Int { 2 }\n',
        'Sources/API/API.swift': 'func request() -> Int { 3 }\n',
    });
    await writeFile(reportPath, JSON.stringify(SWIFT_PACKAGE_COVERAGE_FILES));
    await fakeTool(
        sandbox.path,
        'node_modules/.bin/swift',
        `#!${process.execPath}
import { join } from 'node:path';
const files = (await Bun.file(${JSON.stringify(reportPath)}).json()).map((file) => ({ ...file, filename: join(process.cwd(), file.filename) }));
await Bun.write('coverage.json', JSON.stringify({ data: [{ files }] }));
if (process.argv.includes('--show-codecov-path')) console.log(join(process.cwd(), 'coverage.json'));
else if (process.argv.includes('describe')) console.log(${JSON.stringify(JSON.stringify({ targets: SWIFT_PACKAGE_COVERAGE_TARGETS }))});
`,
    );
    const measured = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
    );
    expect(measured.report.exitCode, JSON.stringify(measured.report)).toBe(1);
    expect(measured.report.checks[0]?.findings.map(({ message }) => message)).toStrictEqual([
        'Core covers 50% of its lines, under the limit of 51%.',
        'API covers 66% of its lines, under the limit of 67%.',
    ]);
    await writeFile(
        reportPath,
        JSON.stringify(SWIFT_PACKAGE_COVERAGE_FILES.filter(({ filename }) => !filename.endsWith('API.swift'))),
    );
    const omitted = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
    );
    expect(omitted.report.exitCode).toBe(2);
    expect(omitted.report.checks[0]?.note).toContain('The Swift coverage report has no source lines for target API.');
});
