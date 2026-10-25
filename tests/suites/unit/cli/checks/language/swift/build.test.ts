import { join, relative } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { findConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { rm, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { listSwiftlintConfigFiles } from '#cli/checks/language/swift/build.ts';
import { SWIFT_PACKAGE, SWIFT_LANGUAGE_PACKAGE } from '#tests/config/swift.ts';
import { prepareBuild, planSwiftBuild } from '#cli/checks/language/swift/cache.ts';

import {
    runSandboxCheck,
    findBuiltInCheck,
    planSandboxCheck,
    prepareSwiftCheck,
    redirectCacheFolder,
} from '#tests/setup/cli/checks.ts';
import {
    ANALYZER_EXIT_CASES,
    PRIVATE_MAIN_FINDING,
    FAILED_BUILD_FINDINGS,
    PRIVATE_OTHER_FINDING,
    NESTED_SWIFTLINT_FILES,
    SWIFT_REPLACEMENT_CASES,
} from '#tests/config/checks/language/swift/build.ts';

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
            findBuiltInCheck('swift/swiftlint-analyze')(prepared.session, prepared.planned),
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
    if (analyzer.kind !== 'package') throw new Error('Expected a Swift package build.');
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

    expect(await findBuiltInCheck('swift/build')(prepared.session, input)).toStrictEqual([]);
    expect(await findBuiltInCheck('swift/swiftlint-analyze')(prepared.session, input)).toStrictEqual([]);
    expect(await readFile(compilerState, 'utf8')).toBe('incremental');
    expect(await isOnDisk(analyzerState)).toBe(false);
    expect(await readFile(analyzer.log, 'utf8')).toBe('complete compiler log\n');
    expect(await readFile(compile.log, 'utf8')).toBe('incremental log\n');
});

test('compiler: a failed Swift build without source errors exits 2, and the next build passes', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'Main.swift': 'let value = 1\n',
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

    expect(await findBuiltInCheck('swift/build')(prepared.session, first)).toStrictEqual([]);
    expect(await findBuiltInCheck('swift/build')(prepared.session, first)).toStrictEqual([]);
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
    expect(compilation.report.checks).toMatchObject([{ status: 'error', note: 'The check was canceled.' }]);
    const analyzer = planSwiftBuild(prepared.session, input, 'analyze');
    if (analyzer.kind !== 'package') throw new Error('Expected a Swift package build.');
    await mkdir(analyzer.scratch, { recursive: true });
    const state = join(analyzer.scratch, 'state');
    await writeFile(state, 'retained compiler state');
    const analysis = await runChecks(prepared.session, buildRunOptions({ only: ['swift/swiftlint-analyze'] }));
    expect(analysis.report.checks).toMatchObject([{ status: 'error', note: 'The check was canceled.' }]);
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

    const buildError = await captureRejection(findBuiltInCheck('swift/build')(prepared.session, input));
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

test('compiler: a Swift build whose source file is missing removes its build.lock, so a later build can take it', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        'Main.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    const plan = planSwiftBuild(session, input);
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    const missingSourceError = await captureRejection(findBuiltInCheck('swift/build')(session, input));
    expect(missingSourceError.message).toBe('Main.swift is tracked but missing. Restore it or commit its deletion.');
    expect(run).not.toHaveBeenCalled();
    expect(await isOnDisk(join(plan.folder, 'build.lock'))).toBe(false);
    await writeFile(join(sandbox.path, 'Main.swift'), 'let value = 1\n');
    const { files } = prepareBuild(session.root, input.files, plan.folder);
    expect(await isOnDisk(join(plan.folder, 'build.lock'))).toBe(true);
    files[Symbol.dispose]();
    expect(await isOnDisk(join(plan.folder, 'build.lock'))).toBe(false);
});

test('compiler: Swift compiler diagnostics drop the macOS /private prefix from source paths', async () => {
    await using sandbox = await testdir();
    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', { 'Main.swift': 'let value = 1\n' });

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
    expect(await findBuiltInCheck('swift/build')(prepared.session, input)).toStrictEqual([
        matchFields(PRIVATE_MAIN_FINDING),
        matchFields(PRIVATE_OTHER_FINDING),
    ]);
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
    const planned = plans.find((plan) => plan.scope.folder.path === 'app')!;
    const shipped = findConfigFilePath(session, 'swiftlint');
    expect(listSwiftlintConfigFiles(session, planned)).toStrictEqual([shipped, ...NESTED_SWIFTLINT_FILES.slice(0, -1)]);
    await symlink('../.swiftlint.yml', join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    expect(listSwiftlintConfigFiles(session, planned)).toStrictEqual([shipped, ...NESTED_SWIFTLINT_FILES]);
});

test.each([...SWIFT_REPLACEMENT_CASES])(
    '$checkId preserves replacement tokens in checkout paths when reporting copied source files',
    async ({ checkId, rule }) => {
        await using parent = await testdir();
        await using sandbox = await testdir({}, { dirname: join(parent.path, 'literal-$&') });
        await using resources = new AsyncDisposableStack();
        resources.use(await prepareSwiftCheck(sandbox, checkId, { 'Main.swift': 'let value = 1\n' }));
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
