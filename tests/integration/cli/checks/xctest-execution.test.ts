import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { onMac } from '#tests/support/cli/platforms.ts';
import { openSession } from '#cli/execution/session.ts';
import { test, expect, describe, afterEach } from 'bun:test';
import { XCTEST_EXECUTION_POLICY, XCTEST_EXECUTION_OPTIONS } from '#tests/inputs/integration/cli/checks.ts';
import { rmSync, chmodSync, mkdirSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

const caches = new Set<string>();
afterEach(() => {
    for (const folder of caches) rmSync(folder, { recursive: true, force: true });
    caches.clear();
});

const SHEBANG = `#!${process.execPath}\n`;
// A one-second tool limit, for the run whose fake xcodebuild sleeps past it.
const SLOW_POLICY = XCTEST_EXECUTION_POLICY.replace('[tools.xcode]', '[limits]\ntool_seconds = 1\n[tools.xcode]');

const CASES = [
    {
        failure: 'no-project',
        policy: XCTEST_EXECUTION_POLICY.replace('project = "Example.xcodeproj"', 'project = ""'),
        build: '',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'failed-test',
        policy: XCTEST_EXECUTION_POLICY,
        build: 'process.exitCode = 65;',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'timeout',
        policy: SLOW_POLICY,
        build: 'await Bun.sleep(10_000);',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'malformed',
        policy: XCTEST_EXECUTION_POLICY,
        build: '',
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-floor',
        policy: XCTEST_EXECUTION_POLICY,
        build: '',
        coverage: 0.5,
        code: 1,
        status: 'fail',
        produced: true,
    },
] as const;

describe.if(onMac)('with the macOS toolchain', () => {
    test.each([...CASES])(
        'XCTest adapter preserves $failure and accepts a corrected run',
        async ({ policy, build, coverage, code, status, produced }) => {
            await using sandbox = await testdir();
            caches.add(buildFolder(sandbox.path));
            await createFileTree(sandbox.path, {
                'gspot.toml': policy,
                'ExampleTests.swift': 'import XCTest\n',
                'Example.xcodeproj/project.pbxproj': '',
                'node_modules/.bin/xcodebuild': `${SHEBANG}${build}\n`,
                'node_modules/.bin/xcrun': `${SHEBANG}await Bun.write('viewed.txt', 'viewed'); console.log(${JSON.stringify(coverage === undefined ? '{}' : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: coverage }] }))});\n`,
            });
            for (const tool of ['xcodebuild', 'xcrun']) chmodSync(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
            const outcome = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
            expect(outcome.report.exitCode).toBe(code);
            expect(outcome.report.checks[0]!.status).toBe(status);
            expect(existsSync(join(sandbox.path, 'viewed.txt'))).toBe(false);
            const viewed = join(buildFolder(sandbox.path), 'swift/root/coverage/source/viewed.txt');
            // The coverage view is kept in the build folder whenever the run got as far as producing it.
            expect(existsSync(viewed) ? readFileSync(viewed, 'utf8') : undefined).toBe(produced ? 'viewed' : undefined);
            writeFileSync(join(sandbox.path, 'gspot.toml'), XCTEST_EXECUTION_POLICY);
            writeFileSync(join(sandbox.path, 'node_modules/.bin/xcodebuild'), `${SHEBANG}\n`);
            writeFileSync(
                join(sandbox.path, 'node_modules/.bin/xcrun'),
                `${SHEBANG}console.log(${JSON.stringify(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }))});\n`,
            );
            const corrected = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'ok', findings: [] }]);
        },
    );
});

describe.if(onMac)('with the macOS toolchain', () => {
    test('XCTest coverage refuses an external result link and replaces a files previous bundle', async () => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        const cache = join(buildFolder(sandbox.path), 'swift/root/coverage');
        caches.add(buildFolder(sandbox.path));
        await createFileTree(sandbox.path, {
            'gspot.toml': XCTEST_EXECUTION_POLICY,
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
            'node_modules/.bin/xcodebuild': `${SHEBANG}const bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1]; if (await Bun.file(bundle + '/data/previous').exists()) throw new Error('Previous bundle survived'); await Bun.write('tested.txt', 'tested');\n`,
            'node_modules/.bin/xcrun': `${SHEBANG}console.log(JSON.stringify({targets:[{name:'Example',lineCoverage:1}]}));\n`,
        });
        for (const tool of ['xcodebuild', 'xcrun']) chmodSync(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
        writeFileSync(join(outside.path, 'authored.txt'), 'preserved');
        mkdirSync(cache, { recursive: true });
        const bundle = join(cache, 'coverage.xcresult');
        symlinkSync(outside.path, bundle, process.platform === 'win32' ? 'junction' : 'dir');
        const refused = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
        expect(refused.report.exitCode).toBe(2);
        expect(readFileSync(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
        expect(existsSync(join(cache, 'source/tested.txt'))).toBe(false);
        rmSync(bundle);
        mkdirSync(join(bundle, 'data'), { recursive: true });
        writeFileSync(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
        const corrected = await executeRun(await openSession(sandbox.path), XCTEST_EXECUTION_OPTIONS);
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(existsSync(bundle)).toBe(false);
        expect(readFileSync(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
        expect(readFileSync(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    });
});
