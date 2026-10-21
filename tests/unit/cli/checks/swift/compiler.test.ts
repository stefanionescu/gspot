import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { SWIFT_PACKAGE } from '#tests/data/checks/swift/package.ts';
import { buildPlan, prepareBuild } from '#cli/checks/swift/cache.ts';
import { SWIFT_LANGUAGE_PACKAGE } from '#tests/data/checks/swift/projects.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { matchFields, matchSubstring, captureRejection } from '#tests/setup/matchers.ts';

import {
    checkFindings,
    planSandboxCheck,
    findBuiltInCheck,
    prepareSwiftCheck,
    createCompilerCache,
} from '#tests/setup/check-input.ts';

test.each([
    { buildCode: 7, analyzerCode: 0, message: /build exited 7/u },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: /^The swiftlint command failed \(exit 7\): The tool printed no error output\.$/u,
    },
])(
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
        expect(
            await captureRejection(findBuiltInCheck('swift/swiftlint-analyze')(prepared.session, prepared.planned)),
        ).toMatch(message);
    },
);

test('analyzer: manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/swiftlint-analyze');

    const input = prepared.planned;
    const compile = buildPlan(prepared.session, input);
    const analyzer = buildPlan(prepared.session, input, { purpose: 'analyze' });
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
    expect(await readFile(analyzer.log, 'utf8')).toContain('complete compiler log');
    expect(await readFile(compile.log, 'utf8')).toContain('incremental log');
});
test('compiler: a failed Swift build without source diagnostics returns execution exit 2 and recovers', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'Main.swift': 'let value = 1\n',
        'Package.swift': SWIFT_LANGUAGE_PACKAGE,
    });

    const options = buildRunOptions({ only: ['swift/build'] });
    const initial = prepared.session;
    const corrected = await openSession(sandbox.path);
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ code: 7, stdout: 'Compiler startup failed', stderr: 'Permission denied' }),
        ),
    );

    const failed = await runChecks(initial, options);

    expect(failed.report.checks).toContainEqual(
        matchFields({
            check: 'swift/build',
            status: 'error',
            findings: [],
            note: matchSubstring('Permission denied'),
        }),
    );
    run.mockResolvedValue(buildProcessResult());
    const executed = await runChecks(corrected, options);
    expect(executed.report.failed).toStrictEqual([]);
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
    expect(await checkFindings(sandbox.path, 'swift/build')).toStrictEqual([
        {
            check: 'swift/build',
            file: 'Main.swift',
            line: 4,
            column: 2,
            rule: 'compiler',
            message: 'Missing value',
            fixable: false,
            help: 'Fix the first compiler error; later ones often come from the same mistake.',
        },
    ]);
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
    const analyzer = buildPlan(prepared.session, input, { purpose: 'analyze' });
    if (analyzer.kind !== 'package') throw new Error('Expected a Swift package build.');
    await mkdir(analyzer.scratch, { recursive: true });
    const state = join(analyzer.scratch, 'state');
    await writeFile(state, 'retained compiler state');
    const analysis = await runChecks(prepared.session, buildRunOptions({ only: ['swift/swiftlint-analyze'] }));
    expect(analysis.report.checks).toMatchObject([{ status: 'error', note: 'The check was canceled.' }]);
    expect(await readFile(state, 'utf8')).toBe('retained compiler state');
    expect(run).not.toHaveBeenCalled();
});

test('compiler: Swift response files stay inside the compiler cache before log publication', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'external-response': 'external bytes must not enter a compiler log',
    });

    const input = prepared.planned;
    const plan = buildPlan(prepared.session, input);

    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ stdout: `swiftc @${join(sandbox.path, 'external-response')}` }),
        ),
    );

    expect(await captureRejection(findBuiltInCheck('swift/build')(prepared.session, input))).toContain(
        'is not a safe repository-relative path',
    );
    expect(await isOnDisk(plan.log)).toBe(false);
    const response = join(plan.folder, 'sources');
    await writeFile(response, 'Sources/Main.swift\nSources/Owner.swift\n');
    run.mockResolvedValue(buildProcessResult({ stdout: `swiftc @${response}` }));
    expect(await checkFindings(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(await readFile(plan.log, 'utf8')).toContain('swiftc Sources/Main.swift Sources/Owner.swift');
});

test('compiler: a failed Swift source preparation releases its build claim before a later writer', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    await using _cache = await createCompilerCache();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        'Main.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    const plan = buildPlan(session, input);
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(spyOn(processes, 'spawnProcess'));
    expect(await captureRejection(findBuiltInCheck('swift/build')(session, input))).toContain('ENOENT');
    expect(run).not.toHaveBeenCalled();
    expect(await isOnDisk(join(plan.folder, 'build.lock'))).toBe(false);
    {
        await writeFile(join(sandbox.path, 'Main.swift'), 'let value = 1\n');
        const prepared = prepareBuild(session.root, input.files, plan.folder);
        using next = prepared.files;
        expect(next.read('build.lock')).toBeDefined();
    }
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
        matchFields({
            file: '/var/folders/project/Main.swift',
            line: 4,
            column: 2,
            rule: 'compiler',
            message: 'Missing value',
        }),

        matchFields({
            file: '/var/folders/project/Other.swift',
            line: 5,
            column: 3,
            rule: 'compiler',
            message: 'Unknown name',
        }),
    ]);
});
