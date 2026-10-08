import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import { useCacheDirectory } from '#tests/harness/environment.ts';
import { buildFolder } from '#cli/checks/language/swift/public.ts';
import { rm, chmod, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { SHEBANG, XCTEST_FAILURES, XCTEST_EXECUTION_POLICY } from '#tests/config/cli/checks/tool/xctest/execution.ts';

const XCTEST_EXECUTION_OPTIONS = buildRunOptions({ stage: 'push', only: ['xctest/coverage'] });

test.skipIf(!isMacos)('XCTest reports a timed-out native command as an error and accepts a later run', async () => {
    await using sandbox = await testdir();
    await using _cache = await useCacheDirectory();
    await createFileTree(sandbox.path, {
        'gspot.toml': XCTEST_EXECUTION_POLICY,
        'ExampleTests.swift': 'import XCTest\n',
        'Example.xcodeproj/project.pbxproj': '',
        'node_modules/.bin/xcodebuild': `${SHEBANG}\n`,
        'node_modules/.bin/xcrun': `${SHEBANG}console.log(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }));\n`,
    });
    for (const tool of ['xcodebuild', 'xcrun']) await chmod(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
    const session = await openSession(sandbox.path);
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: '',
        missing: false,
        duration: 1,
        isTimedOut: true,
    });
    try {
        const failed = await executeRun(session, { ...XCTEST_EXECUTION_OPTIONS, checks: BUILT_IN_CHECKS });
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'error' }]);
        expect(failed.report.checks[0]?.note).toContain('xcodebuild ran past');
        expect(await pathExists(join(buildFolder(sandbox.path), 'swift/root/coverage/source/viewed.txt'))).toBe(false);
    } finally {
        run.mockRestore();
    }
    const corrected = await executeRun(await openSession(sandbox.path), {
        ...XCTEST_EXECUTION_OPTIONS,
        checks: BUILT_IN_CHECKS,
    });
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'passed', findings: [] }]);
});
test.skipIf(!isMacos).each([...XCTEST_FAILURES])(
    'XCTest adapter preserves $failure and accepts a corrected run',
    async ({ policy, build, coverage, code, status, produced }) => {
        await using sandbox = await testdir();
        await using _cache = await useCacheDirectory();
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
            'node_modules/.bin/xcodebuild': `${SHEBANG}${build}\n`,
            'node_modules/.bin/xcrun': `${SHEBANG}await Bun.write('viewed.txt', 'viewed'); console.log(${JSON.stringify(coverage === undefined ? '{}' : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: coverage }] }))});\n`,
        });
        for (const tool of ['xcodebuild', 'xcrun']) await chmod(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
        const outcome = await executeRun(await openSession(sandbox.path), {
            ...XCTEST_EXECUTION_OPTIONS,
            checks: BUILT_IN_CHECKS,
        });
        expect(outcome.report.exitCode).toBe(code);
        expect(outcome.report.checks[0]!.status).toBe(status);
        expect(await pathExists(join(sandbox.path, 'viewed.txt'))).toBe(false);
        const viewed = join(buildFolder(sandbox.path), 'swift/root/coverage/source/viewed.txt');
        // The coverage view is kept in the build folder whenever the run got as far as producing it.
        expect((await pathExists(viewed)) ? await readFile(viewed, 'utf8') : undefined).toBe(
            produced ? 'viewed' : undefined,
        );
        await writeFile(join(sandbox.path, 'gspot.toml'), XCTEST_EXECUTION_POLICY);
        await writeFile(join(sandbox.path, 'node_modules/.bin/xcodebuild'), `${SHEBANG}\n`);
        await writeFile(
            join(sandbox.path, 'node_modules/.bin/xcrun'),
            `${SHEBANG}console.log(${JSON.stringify(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }))});\n`,
        );
        const corrected = await executeRun(await openSession(sandbox.path), {
            ...XCTEST_EXECUTION_OPTIONS,
            checks: BUILT_IN_CHECKS,
        });
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'passed', findings: [] }]);
    },
);

test.skipIf(!isMacos)(
    'XCTest coverage refuses an external result link and replaces a files previous bundle',
    async () => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await using _cache = await useCacheDirectory();
        const cache = join(buildFolder(sandbox.path), 'swift/root/coverage');
        await createFileTree(sandbox.path, {
            'gspot.toml': XCTEST_EXECUTION_POLICY,
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
            'node_modules/.bin/xcodebuild': `${SHEBANG}const bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1]; if (await Bun.file(bundle + '/data/previous').exists()) throw new Error('Previous bundle survived'); await Bun.write('tested.txt', 'tested');\n`,
            'node_modules/.bin/xcrun': `${SHEBANG}console.log(JSON.stringify({targets:[{name:'Example',lineCoverage:1}]}));\n`,
        });
        for (const tool of ['xcodebuild', 'xcrun']) await chmod(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
        await writeFile(join(outside.path, 'authored.txt'), 'preserved');
        await mkdir(cache, { recursive: true });
        const bundle = join(cache, 'coverage.xcresult');
        await symlink(outside.path, bundle, process.platform === 'win32' ? 'junction' : 'dir');
        const refused = await executeRun(await openSession(sandbox.path), {
            ...XCTEST_EXECUTION_OPTIONS,
            checks: BUILT_IN_CHECKS,
        });
        expect(refused.report.exitCode).toBe(2);
        expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
        expect(await pathExists(join(cache, 'source/tested.txt'))).toBe(false);
        await rm(bundle);
        await mkdir(join(bundle, 'data'), { recursive: true });
        await writeFile(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
        const corrected = await executeRun(await openSession(sandbox.path), {
            ...XCTEST_EXECUTION_OPTIONS,
            checks: BUILT_IN_CHECKS,
        });
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(await pathExists(bundle)).toBe(false);
        expect(await readFile(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
        expect(await readFile(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    },
);
