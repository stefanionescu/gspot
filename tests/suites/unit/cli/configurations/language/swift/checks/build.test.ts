import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import {
    FAILED_BUILD_FINDINGS,
    PRIVATE_MAIN_FINDING,
    PRIVATE_OTHER_FINDING,
    SWIFT_REPLACEMENT_CASES,
    UNEXPECTED_PLAN_MESSAGE,
} from '#tests/config/configurations/swift.ts';
import { SWIFT_LANGUAGE_PACKAGE, SWIFT_VALUE_SOURCE } from '#tests/config/setup/languages.ts';
import { SWIFT_PACKAGE } from '#tests/config/setup/programs.ts';
import { CANCELED_CHECK_NOTE } from '#tests/config/setup/sandboxes.ts';
import {
    getBuiltInCheck,
    planSandboxCheck,
    prepareSwiftCheck,
    redirectCacheFolder,
    runSandboxCheck,
} from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection, matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('compiler: a failed Swift build without source errors exits 2, and the next build passes', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'Main.swift': SWIFT_VALUE_SOURCE,
        'Package.swift': SWIFT_LANGUAGE_PACKAGE,
    });

    const options = buildRunOptions({ only: ['swift/build'] });
    const corrected = await openSession(sandbox.path);
    const run = resources.use(
        fakeCommands().mockResolvedValue(
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
            note: expect.stringContaining('Compiler startup failed\nPermission denied') as string,
        },
    ]);
    run.mockResolvedValue(buildProcessResult());
    const checked = await runChecks(corrected, options);
    expect(checked.report.failed).toStrictEqual([]);
});

test('compiler: a later Swift session reads a failed build after an earlier successful build', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const first = prepared.planned;

    resources.use(
        fakeCommands()
            .mockResolvedValueOnce(buildProcessResult())
            .mockResolvedValue(
                buildProcessResult({ code: 1, stderr: `${sandbox.path}/Main.swift:4:2: error: Missing value` }),
            ),
    );

    expect(await getBuiltInCheck('swift/build')(prepared.session, first)).toStrictEqual([]);
    expect(await getBuiltInCheck('swift/build')(prepared.session, first)).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'swift/build')).toStrictEqual(
        FAILED_BUILD_FINDINGS.map((finding) => matchFields(finding)),
    );
});

test('compiler: canceled Swift compilation refuses to launch the compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const input = prepared.planned;
    prepared.session.cancelSignal = AbortSignal.abort();
    const run = resources.use(fakeCommands());
    const compilation = await runChecks(prepared.session, buildRunOptions({ only: ['swift/build'] }));
    expect(compilation.report.checks).toMatchObject([{ status: 'canceled', note: CANCELED_CHECK_NOTE }]);
    const analyzer = planSwiftBuild(prepared.session, input);
    if (analyzer.kind !== 'package') throw new Error(UNEXPECTED_PLAN_MESSAGE);
    await mkdir(analyzer.scratch, { recursive: true });
    const state = join(analyzer.scratch, 'state');
    await writeFile(state, 'retained compiler state');
    const analysis = await runChecks(prepared.session, buildRunOptions({ only: ['swift/swiftlint-analyze'] }));
    expect(analysis.report.checks).toMatchObject([{ status: 'canceled', note: CANCELED_CHECK_NOTE }]);
    expect(await readFile(state, 'utf8')).toBe('retained compiler state');
    expect(run).not.toHaveBeenCalled();
});

test('compiler: swift/build refuses a response file outside the compiler cache and writes its log only with one inside', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'external-response': 'external bytes must not enter a compiler log',
    });

    const input = prepared.planned;
    const plan = planSwiftBuild(prepared.session, input);

    const spawn = fakeCommands().mockResolvedValue(
        buildProcessResult({ stdout: `swiftc @${join(sandbox.path, 'external-response')}` }),
    );
    const run = resources.use(spawn);

    const buildError = await captureRejection(getBuiltInCheck('swift/build')(prepared.session, input));
    const external = convertToPosixPath(relative(plan.folder, join(sandbox.path, 'external-response')));
    expect(buildError).toMatchObject({ name: 'GspotError', code: 'filesystem' });
    expect(buildError.message).toContain(external);
    expect(existsSync(plan.log)).toBe(false);
    const response = join(plan.folder, 'sources');
    await writeFile(response, 'Sources/Main.swift\nSources/Owner.swift\n');
    run.mockResolvedValue(buildProcessResult({ stdout: `swiftc @${response}` }));
    expect(await runSandboxCheck(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(await readFile(plan.log, 'utf8')).toBe('swiftc Sources/Main.swift Sources/Owner.swift\n');
});

test('compiler: a Swift build whose source file is missing names the file and runs no compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        'Main.swift': SWIFT_VALUE_SOURCE,
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(fakeCommands());
    const missingSourceError = await captureRejection(getBuiltInCheck('swift/build')(session, input));
    expect(missingSourceError).toMatchObject({ name: 'GspotError', code: 'filesystem' });
    expect(missingSourceError.message).toContain('Main.swift');
    expect(run).not.toHaveBeenCalled();
});

test('compiler: Swift compiler messages drop the macOS /private prefix from source paths', async () => {
    await using sandbox = await createGitSandbox({});
    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', { 'Main.swift': SWIFT_VALUE_SOURCE });

    const input = prepared.planned;
    using resources = new DisposableStack();
    resources.use(
        fakeCommands().mockResolvedValue(
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
        runGitStep(sandbox.path, ['init', '--quiet']);
        await using resources = new AsyncDisposableStack();
        resources.use(await prepareSwiftCheck(sandbox, checkId, { 'Main.swift': SWIFT_VALUE_SOURCE }));
        resources.use(
            fakeCommands().mockImplementation((_command, options) =>
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
