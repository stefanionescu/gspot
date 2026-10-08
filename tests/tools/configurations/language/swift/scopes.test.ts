// The swift configuration inside a scope: the tools read the scope's configuration and findings carry its path.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { CAST_SWIFT, CLEAN_SWIFT } from '#tests/config/samples/swift/source.ts';

test('the swift configuration inside a scope > SwiftLint and SwiftFormat read the configuration of their scope, and the findings keep the scope path', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'ios/Sources/App/Greeting.swift': CLEAN_SWIFT,
        'README.md': '# test\n',
    });
    commitAll(sandbox.path);
    const environment = { PATH: buildToolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
    const argv = ['init', '--yes', '--scope-configurations', 'ios=swift', ...QUIET_INIT];
    await initRepository(sandbox.path, argv, environment, { level: 'all' });
    for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
        const clean = await spawnGspot(sandbox.path, ['check', '--only', id], environment);
        expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
    }
    const outcome = await runCheckCase(
        sandbox.path,
        { check: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST_SWIFT } },
        environment,
    );
    // SwiftLint has no Windows build, so the check is skipped there with a note and the run passes.
    const isWindows = process.platform === 'win32';
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isWindows ? 0 : 1);
    expect(outcome.stdout.includes('swiftlint has no Windows build')).toBe(isWindows);
    const failed = JSON.parse(outcome.stdout) as RunReport;
    expect(failed.checks).toMatchObject([
        { check: 'swift/swiftlint', scope: 'ios', status: isWindows ? 'skipped' : 'failed' },
    ]);
    const cast: Finding = containing({ file: 'ios/Sources/App/Cast.swift', rule: 'force_cast', line: 5 });
    const expectedFindings: Finding[] = containingAll([cast]);
    expect(failed.checks[0]!.findings).toStrictEqual(isWindows ? [] : expectedFindings);
    await Bun.write(
        join(sandbox.path, 'ios/Sources/App/Cast.swift'),
        CLEAN_SWIFT.replace('greeting', 'correctedGreeting'),
    );
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'swift/swiftlint', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'swift/swiftlint', scope: 'ios', status: isWindows ? 'skipped' : 'passed', findings: [] },
    ]);
});
