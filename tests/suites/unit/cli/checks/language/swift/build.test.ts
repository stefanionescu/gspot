import { join, relative } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { CANCELED_CHECK_NOTE } from '#tests/config/messages.ts';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { UNEXPECTED_PLAN_MESSAGE } from '#tests/config/checks/language/swift/messages.ts';
import { SWIFT_PACKAGE, SWIFT_VALUE_SOURCE, SWIFT_LANGUAGE_PACKAGE } from '#tests/config/swift.ts';

import {
    runSandboxCheck,
    getBuiltInCheck,
    planSandboxCheck,
    prepareSwiftCheck,
    redirectCacheFolder,
} from '#tests/setup/cli/checks.ts';
import {
    PRIVATE_MAIN_FINDING,
    FAILED_BUILD_FINDINGS,
    PRIVATE_OTHER_FINDING,
    SWIFT_REPLACEMENT_CASES,
} from '#tests/config/checks/language/swift/build.ts';

test('compiler: a failed Swift build without source errors exits 2, and the next build passes', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'Main.swift': SWIFT_VALUE_SOURCE,
        'Package.swift': SWIFT_LANGUAGE_PACKAGE,
    });

    const options = buildRunOptions({ only: ['swift/build'] });
    const corrected = await openSession(sandbox.path);
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: 7, stdout: 'Compiler startup failed', stderr: 'Permission denied' }),
        ),
    );

    const failed = await runChecks(prepared.session, options);

    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'swift/build',
            status: 'error',
            findings: [],
            note: 'The swift/build check failed: The Swift build command failed (exit 7): Compiler startup failed\nPermission denied',
        },
    ]);
    run.mockResolvedValue(buildProcessResult());
    const checked = await runChecks(corrected, options);
    expect(checked.report.failed).toStrictEqual([]);
});

test('compiler: a later Swift session reads a failed build after an earlier successful build', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const first = prepared.planned;

    resources.use(
        spyOn(processes, 'spawnProcess')
            .mockResolvedValueOnce(buildProcessResult())
            .mockResolvedValue(
                buildProcessResult({ code: 1, stderr: `${sandbox.path}/Main.swift:4:2: error: Missing value` }),
            ),
    );

    expect(await getBuiltInCheck('swift/build')(prepared.session, first)).toStrictEqual([]);
    expect(await getBuiltInCheck('swift/build')(prepared.session, first)).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'swift/build')).toStrictEqual([...FAILED_BUILD_FINDINGS]);
});

test('compiler: canceled Swift compilation refuses to launch the compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const input = prepared.planned;
    prepared.session.cancelSignal = AbortSignal.abort();
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const compilation = await runChecks(prepared.session, buildRunOptions({ only: ['swift/build'] }));
    expect(compilation.report.checks).toMatchObject([{ status: 'error', note: CANCELED_CHECK_NOTE }]);
    const analyzer = planSwiftBuild(prepared.session, input, 'analyze');
    if (analyzer.kind !== 'package') throw new Error(UNEXPECTED_PLAN_MESSAGE);
    await mkdir(analyzer.scratch, { recursive: true });
    const state = join(analyzer.scratch, 'state');
    await writeFile(state, 'retained compiler state');
    const analysis = await runChecks(prepared.session, buildRunOptions({ only: ['swift/swiftlint-analyze'] }));
    expect(analysis.report.checks).toMatchObject([{ status: 'error', note: CANCELED_CHECK_NOTE }]);
    expect(await readFile(state, 'utf8')).toBe('retained compiler state');
    expect(run).not.toHaveBeenCalled();
});

test('compiler: swift/build refuses a response file outside the compiler cache and writes its log only with one inside', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'external-response': 'external bytes must not enter a compiler log',
    });

    const input = prepared.planned;
    const plan = planSwiftBuild(prepared.session, input);

    const spawn = spyOn(processes, 'spawnProcess').mockResolvedValue(
        buildProcessResult({ stdout: `swiftc @${join(sandbox.path, 'external-response')}` }),
    );
    const run = resources.use(spawn);

    const buildError = await captureRejection(getBuiltInCheck('swift/build')(prepared.session, input));
    expect(buildError.message).toBe(
        `"${convertToPosixPath(relative(plan.folder, join(sandbox.path, 'external-response')))}" is not a safe repository-relative path. Choose a path inside the repository.`,
    );
    expect(await isOnDisk(plan.log)).toBe(false);
    const response = join(plan.folder, 'sources');
    await writeFile(response, 'Sources/Main.swift\nSources/Owner.swift\n');
    run.mockResolvedValue(buildProcessResult({ stdout: `swiftc @${response}` }));
    expect(await runSandboxCheck(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(await readFile(plan.log, 'utf8')).toBe('swiftc Sources/Main.swift Sources/Owner.swift\n');
});

test('compiler: a Swift build whose source file is missing names the file and runs no compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        'Main.swift': SWIFT_VALUE_SOURCE,
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const missingSourceError = await captureRejection(getBuiltInCheck('swift/build')(session, input));
    expect(missingSourceError.message).toBe('Main.swift is tracked but missing. Restore it or commit its deletion.');
    expect(run).not.toHaveBeenCalled();
});

test('compiler: Swift compiler messages drop the macOS /private prefix from source paths', async () => {
    await using sandbox = await testdir();
    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', { 'Main.swift': SWIFT_VALUE_SOURCE });

    const input = prepared.planned;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({
                code: 1,
                stderr: '/private/var/folders/project/Main.swift:4:2: error: Missing value\n/var/folders/project/Other.swift:5:3: error: Unknown name',
            }),
        ),
    );
    expect(await getBuiltInCheck('swift/build')(prepared.session, input)).toStrictEqual([
        matchFields(PRIVATE_MAIN_FINDING),
        matchFields(PRIVATE_OTHER_FINDING),
    ]);
});

test.each([...SWIFT_REPLACEMENT_CASES])(
    '$checkId preserves replacement tokens in checkout paths when reporting copied source files',
    async ({ checkId, rule }) => {
        await using parent = await testdir();
        await using sandbox = await testdir({}, { dirname: join(parent.path, 'literal-$&') });
        await using resources = new AsyncDisposableStack();
        resources.use(await prepareSwiftCheck(sandbox, checkId, { 'Main.swift': SWIFT_VALUE_SOURCE }));
        resources.use(
            spyOn(processes, 'spawnProcess').mockImplementation((_command, options) =>
                Promise.resolve(buildProcessResult({ stderr: `${options.cwd}/Main.swift:4:2: error: Missing value` })),
            ),
        );
        const findings = await runSandboxCheck(sandbox.path, checkId);
        expect(findings).toStrictEqual([
            matchFields({
                check: checkId,
                file: 'Main.swift',
                line: 4,
                column: 2,
                rule,
                message: 'Missing value',
            }),
        ]);
    },
);
