import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { getBuiltInCheck, prepareSwiftCheck } from '#tests/setup/cli/checks.ts';
import { listSwiftlintConfigFiles } from '#cli/checks/language/swift/swiftlint.ts';
import { UNEXPECTED_PLAN_MESSAGE } from '#tests/config/checks/language/swift/messages.ts';
import { ANALYZER_EXIT_CASES, NESTED_SWIFTLINT_FILES } from '#tests/config/checks/language/swift/swiftlint.ts';

test.each([...ANALYZER_EXIT_CASES])(
    'analyzer: build exit $buildCode and analyzer exit $analyzerCode report the failed stage',
    async ({ buildCode, analyzerCode, message }) => {
        await using sandbox = await testdir();
        await using resources = new AsyncDisposableStack();
        await using prepared = await prepareSwiftCheck(sandbox, 'swift/swiftlint-analyze');
        resources.use(
            spyOn(processes, 'spawnProcess')
                .mockResolvedValueOnce(buildProcessResult({ code: buildCode }))
                .mockResolvedValue(buildProcessResult({ code: analyzerCode })),
        );
        const rejection = await captureRejection(
            getBuiltInCheck('swift/swiftlint-analyze')(prepared.session, prepared.planned),
        );
        expect(rejection.message).toBe(message);
    },
);

test('analyzer: swift/swiftlint-analyze removes its own old compiler files and leaves the incremental build of swift/build in place', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/swiftlint-analyze');

    const input = prepared.planned;
    const compile = planSwiftBuild(prepared.session, input);
    const analyzer = planSwiftBuild(prepared.session, input, 'analyze');
    if (analyzer.kind !== 'package') throw new Error(UNEXPECTED_PLAN_MESSAGE);
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch, 'state');
    await mkdir(join(compile.folder, 'package'), { recursive: true });
    await mkdir(analyzer.scratch, { recursive: true });
    await writeFile(compilerState, 'incremental');
    await writeFile(analyzerState, 'old analyzer');
    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'incremental log' }))
            .mockResolvedValueOnce(buildProcessResult({ stdout: 'complete compiler log' }))
            .mockResolvedValue(buildProcessResult()),
    );

    expect(await getBuiltInCheck('swift/build')(prepared.session, input)).toStrictEqual([]);
    expect(await getBuiltInCheck('swift/swiftlint-analyze')(prepared.session, input)).toStrictEqual([]);
    expect(await readFile(compilerState, 'utf8')).toBe('incremental');
    expect(await isOnDisk(analyzerState)).toBe(false);
    expect(await readFile(analyzer.log, 'utf8')).toBe('complete compiler log\n');
    expect(await readFile(compile.log, 'utf8')).toBe('incremental log\n');
});

test('the SwiftLint config files of a nested scope stop at the scope folder and include a link inside the repository', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift'], { scopes: [{ path: 'app' }] }),
        '.swiftlint.yml': 'disabled_rules: []\n',
        'app/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/Feature/One.swift': 'let one = 1\n',
        'app/Sources/Feature/Two.swift': 'let two = 2\n',
        'app/Other/.swiftlint.yml': 'disabled_rules: []\n',
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
    const planned = plans.find((plan) => plan.scope.path === 'app')!;
    const shipped = getConfigFilePath(session, 'swiftlint');
    expect(listSwiftlintConfigFiles(session, planned)).toStrictEqual([shipped, ...NESTED_SWIFTLINT_FILES.slice(0, -1)]);
    await symlink('../.swiftlint.yml', join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    expect(listSwiftlintConfigFiles(session, planned)).toStrictEqual([shipped, ...NESTED_SWIFTLINT_FILES]);
});
