import { existsSync } from 'node:fs';
import { mkdir, open, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { acquireBuildLock, planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import * as processes from '#cli/system/processes.ts';
import { SWIFT_PROJECT_SELECTION_CASES } from '#tests/config/configurations/swift.ts';
import { SWIFT_PACKAGE_HEADER, SWIFT_VALUE_SOURCE, XCTEST_SOURCE } from '#tests/config/setup/languages.ts';
import { SWIFT_PACKAGE } from '#tests/config/setup/programs.ts';
import {
    getBuiltInCheck,
    planSandboxCheck,
    prepareSwiftCheck,
    redirectCacheFolder,
    runSandboxCheck,
} from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { fakePlatform } from '#tests/setup/system/platform.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'the swift/build plan $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await createGitSandbox({
            ...files,
            'gspot.toml': buildSandboxSettings(['swift'], { tables }),
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build', { scope });
        const plan = planSwiftBuild(session, input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.commandArguments[plan.commandArguments.indexOf(container) + 1]).toBe(argument);
    },
);

test('Swift skips without swift.xcode_project or Package.swift, then builds the package once Package.swift exists', async () => {
    using _host = fakePlatform('darwin');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        'App.xcodeproj/project.pbxproj': '',
        'ExampleTests/Example.swift': XCTEST_SOURCE,
    });

    const session = await openSession(sandbox.path);
    using _executables = fakeToolExecutables(
        readConfigurations()
            .values()
            .flatMap((configuration) => configuration.tools)
            .toArray(),
    );
    const run = await runChecks(session, buildRunOptions({ only: ['swift/build'] }));

    expect(run.report.checks).toMatchObject([
        {
            check: 'swift/build',
            status: 'skipped',
            findings: [],
            note: expect.stringContaining('swift.xcode_project') as string,
        },
    ]);
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE_HEADER,
    });
    const checkedSession = await openSession(sandbox.path);
    const packageInput = planSandboxCheck(checkedSession, 'swift/build');
    const plan = planSwiftBuild(checkedSession, packageInput);
    expect(existsSync(plan.folder)).toBe(false);
    expect(plan.kind).toBe('package');
});

test('an Xcode project without a scheme is a settings error', async () => {
    await using sandbox = await createGitSandbox({});
    await using _prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'gspot.toml': buildSandboxSettings(['swift'], { tables: '[swift]\nxcode_project = "App.xcodeproj"\n' }),
        'App.xcodeproj/project.pbxproj': '',
    });
    expect(await captureRejection(runSandboxCheck(sandbox.path, 'swift/build'))).toMatchObject({
        name: 'GspotError',
        code: 'settings',
    });
});

test('compiler: a Swift build whose source file is missing names the file and runs no compiler', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildSandboxSettings(['swift']),
        'Main.swift': SWIFT_VALUE_SOURCE,
    });
    await using _cache = await redirectCacheFolder();
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    await rm(join(sandbox.path, 'Main.swift'));
    const run = resources.use(fakeCommands());
    const missingSourceError = await captureRejection(getBuiltInCheck('swift/build')(session, input));
    expect(missingSourceError).toMatchObject({ name: 'GspotError', code: 'filesystem' });
    expect(missingSourceError.message).toContain('Main.swift');
    expect(run).not.toHaveBeenCalled();
});

test('the Swift build folder lives in the gspot cache and differs between repositories', async () => {
    await using first = await createGitSandbox({});
    await using second = await createGitSandbox({});
    await using _cache = await redirectCacheFolder();
    for (const root of [first.path, second.path])
        await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const firstSession = await openSession(first.path);
    const firstInput = planSandboxCheck(firstSession, 'swift/build');
    const secondSession = await openSession(second.path);
    const secondInput = planSandboxCheck(secondSession, 'swift/build');
    const folder = planSwiftBuild(firstSession, firstInput).folder;
    expect(folder).not.toBe(planSwiftBuild(secondSession, secondInput).folder);
    expect(folder).toStartWith(readCacheFolder() + sep);
});

test('two copies of one repository that share a tools root share one build folder', async () => {
    const files = { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE };
    await using installed = await createGitSandbox(files);
    await using first = await createGitSandbox(files);
    await using second = await createGitSandbox(files);
    await using _cache = await redirectCacheFolder();
    const session = await openSession(installed.path);
    const installedInput = planSandboxCheck(session, 'swift/build');
    const firstSession = await openSession(first.path, { toolsRoot: installed.path });
    const firstInput = planSandboxCheck(firstSession, 'swift/build');
    const secondSession = await openSession(second.path, { toolsRoot: installed.path });
    const secondInput = planSandboxCheck(secondSession, 'swift/build');
    const firstFolder = planSwiftBuild(firstSession, firstInput).folder;
    const secondFolder = planSwiftBuild(secondSession, secondInput).folder;
    expect(firstFolder).toBe(secondFolder);
    expect(firstFolder).toBe(planSwiftBuild(session, installedInput).folder);
});

async function createLockedFolder(): Promise<string> {
    const folder = join(readCacheFolder(), 'scope');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'build.lock'), '1');
    return folder;
}

test('a build lock holds this process ID until disposal', async () => {
    await using _cache = await redirectCacheFolder();
    const folder = join(readCacheFolder(), 'scope');
    const lock = await acquireBuildLock(folder, undefined);
    expect(await readFile(join(folder, 'build.lock'), 'utf8')).toBe(String(process.pid));
    lock[Symbol.dispose]();
    expect(existsSync(join(folder, 'build.lock'))).toBe(false);
});

test('a build replaces the lock of a stopped process', async () => {
    await using _cache = await redirectCacheFolder();
    const folder = await createLockedFolder();
    using _stopped = spyOn(processes, 'isProcessRunning').mockReturnValue(false);
    using _lock = await acquireBuildLock(folder, undefined);
    expect(await readFile(join(folder, 'build.lock'), 'utf8')).toBe(String(process.pid));
});

test('a build waits for the lock of a running process until the run stops', async () => {
    await using _cache = await redirectCacheFolder();
    const folder = await createLockedFolder();
    using _running = spyOn(processes, 'isProcessRunning').mockReturnValue(true);
    const stopped = await captureRejection(acquireBuildLock(folder, AbortSignal.abort()));
    expect(stopped.name).toBe('AbortError');
    expect(await readFile(join(folder, 'build.lock'), 'utf8')).toBe('1');
});

test('Swift build side effects stay in the source copy and do not reach later runs', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'Sources/Value.swift': SWIFT_VALUE_SOURCE,
    });

    const previous = join(sandbox.path, 'Sources/Value.swift');
    const initial = prepared.planned;

    const sources: string[] = [];
    const artifacts: boolean[][] = [];
    resources.use(
        fakeCommands().mockImplementation(async (_argv, options) => {
            const cwd = options.cwd;
            sources.push(await readFile(join(cwd, 'Sources/Value.swift'), 'utf8'));
            artifacts.push([existsSync(join(cwd, 'Generated')), existsSync(join(cwd, 'Package.resolved'))]);
            await mkdir(join(cwd, 'Generated'));
            await symlink('Generated', join(cwd, 'generated-link'), 'dir');
            await writeFile(join(cwd, 'Generated/side-effect'), 'generated');
            await writeFile(join(cwd, 'Package.resolved'), 'generated resolution');
            await writeFile(join(cwd, 'Sources/Value.swift'), 'modified by build');
            return buildProcessResult();
        }),
    );
    expect(await getBuiltInCheck('swift/build')(prepared.session, initial)).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(sources).toStrictEqual([SWIFT_VALUE_SOURCE, SWIFT_VALUE_SOURCE]);
    expect(artifacts).toStrictEqual([
        [false, false],
        [false, false],
    ]);
    await using originalFile = await open(previous, 'r');
    expect(await originalFile.readFile('utf8')).toBe(SWIFT_VALUE_SOURCE);
    expect(existsSync(join(sandbox.path, 'Package.resolved'))).toBe(false);
    expect(existsSync(join(sandbox.path, 'Generated'))).toBe(false);
});

test('Periphery build side effects stay in its source copy and findings name the repository source paths', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/periphery', {
        'Main.swift': 'let unused = 1\n',
    });

    const input = prepared.planned;
    const sources: string[] = [];
    resources.use(
        fakeCommands().mockImplementation(async (argv, options) => {
            const { cwd } = options;
            sources.push(await readFile(join(cwd, 'Main.swift'), 'utf8'));
            await writeFile(join(cwd, 'Package.resolved'), 'generated by the build');
            return argv.includes('scan')
                ? buildProcessResult({ code: 1, stdout: `${cwd}/Main.swift:1:5: warning: Property unused is unused` })
                : buildProcessResult();
        }),
    );
    expect(await getBuiltInCheck('swift/periphery')(prepared.session, input)).toMatchObject([
        { file: 'Main.swift', line: 1, column: 5, rule: 'unused' },
    ]);
    expect(sources).toStrictEqual(['let unused = 1\n', 'let unused = 1\n']);
    expect(existsSync(join(sandbox.path, 'Package.resolved'))).toBe(false);
});

test('two runs of one scope build in turn under its lock', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const session = await openSession(sandbox.path);
    const periphery = planSandboxCheck(session, 'swift/periphery');
    const running = { builds: 0, most: 0 };
    resources.use(
        fakeCommands().mockImplementation(async (argv) => {
            if (argv.includes('scan')) return buildProcessResult();
            running.builds += 1;
            running.most = Math.max(running.most, running.builds);
            await delay(1);
            running.builds -= 1;
            return buildProcessResult();
        }),
    );
    expect(
        await Promise.all([
            getBuiltInCheck('swift/build')(prepared.session, prepared.planned),
            getBuiltInCheck('swift/periphery')(session, periphery),
        ]),
    ).toStrictEqual([[], []]);
    expect(running.most).toBe(1);
});

test('one run builds a scope once for its build and Periphery checks', async () => {
    using resources = new DisposableStack();

    await using sandbox = await createGitSandbox({});

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const run = resources.use(fakeCommands().mockResolvedValue(buildProcessResult()));
    await getBuiltInCheck('swift/build')(prepared.session, prepared.planned);
    await getBuiltInCheck('swift/periphery')(prepared.session, prepared.planned);
    expect(run.mock.calls.filter(([argv]) => argv.includes('--build-tests'))).toHaveLength(1);
});
