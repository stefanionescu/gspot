import { sep, join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { readCacheFolder } from '#cli/system/environment.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakePinnedExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { SWIFT_PACKAGE } from '#tests/config/checks/language/swift/build.ts';
import { SWIFT_PACKAGE_HEADER } from '#tests/config/checks/language/swift/samples.ts';
import { rm, open, stat, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { buildPlan, prepareBuild, getScopeBuildFolder } from '#cli/checks/language/swift/cache.ts';
import { SWIFT_BUILD_PURPOSES, SWIFT_PROJECT_SELECTION_CASES } from '#tests/config/checks/language/swift/cache.ts';

import {
    runSandboxCheck,
    findBuiltInCheck,
    planSandboxCheck,
    prepareSwiftCheck,
    redirectCacheFolder,
} from '#tests/setup/cli/checks.ts';

test.each(['default', 'platform=macOS'])(
    'Xcode build plans keep destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const declared = destination === 'default' ? '' : `xcode_destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n${declared}`,
            }),
        });
        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build');
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const { commandArguments } = buildPlan(session, input, { purpose });
            expect(commandArguments[commandArguments.indexOf('-destination') + 1]).toBe(
                destination === 'default'
                    ? configurationTableSchemas.swift.unwrap().shape.xcode_destination.parse(undefined)
                    : destination,
            );
            expect(commandArguments[commandArguments.indexOf('-scheme') + 1]).toBe('App');
            expect(commandArguments).toContain('App.xcodeproj');
        }
    },
);
test.each([...SWIFT_PROJECT_SELECTION_CASES])(
    'the swift/build plan $name',
    async ({ scope, tables, files, project, argument }) => {
        await using sandbox = await testdir({ ...files, 'gspot.toml': buildSandboxSettings(['swift'], { tables }) });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'swift/build', { scope });
        expect(getTable(input.scope.settings, 'swift').xcode_project).toBe(project);
        const plan = buildPlan(session, input);
        const container = project.endsWith('.xcworkspace') ? '-workspace' : '-project';
        expect(plan.commandArguments[plan.commandArguments.indexOf(container) + 1]).toBe(argument);
    },
);
test.each([...SWIFT_BUILD_PURPOSES])(
    'Swift $purpose skips without swift.xcode_project or Package.swift, then builds the package once Package.swift exists',
    async ({ purpose, check }) => {
        using _host = simulateOperatingSystem('darwin');
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift']),
            'App.xcodeproj/project.pbxproj': '',
            'ExampleTests/Example.swift': 'import XCTest\n',
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, check);
        expect(() => buildPlan(session, input, { purpose })).toThrow(
            new GspotError('skip', 'Set swift.xcode_project or add Package.swift in this scope.'),
        );
        using _executables = fakePinnedExecutables(
            [...session.configurations.values()].flatMap((configuration) => configuration.tools),
        );
        const executed = await runChecks(session, buildRunOptions({ only: [check] }));

        expect(executed.report.checks).toContainEqual(
            matchFields({
                check,
                status: 'skipped',
                findings: [],
                note: expect.stringContaining('swift.xcode_project') as string,
            }),
        );
        expect(await isOnDisk(getScopeBuildFolder(session.installedRoot, input.scope.folder.path, purpose))).toBe(
            false,
        );
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE_HEADER,
        });
        const checkedSession = await openSession(sandbox.path);
        const packageInput = planSandboxCheck(checkedSession, 'swift/build');
        const plan = buildPlan(checkedSession, packageInput, { purpose });
        expect(plan.commandArguments[0]).toBe('swift');
        if (plan.kind !== 'package') throw new Error('Expected a Swift package build.');
        expect(plan.commandArguments).toContain(plan.scratch);
        if (purpose === 'coverage') expect(plan.commandArguments).toContain('--enable-code-coverage');
    },
);
test('build cache rejects external output links and concurrent writers', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await using _cache = await redirectCacheFolder();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_PACKAGE,
    });
    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'swift/build');
    const folder = buildPlan(session, input).folder;
    const held = prepareBuild(session.root, input.files, folder);
    const heldFiles = held.files;
    expect(heldFiles.read('build.lock')).toBeDefined();
    expect(() => prepareBuild(session.root, input.files, folder)).toThrow('Another gspot command');
    heldFiles[Symbol.dispose]();
    const authored = join(outside.path, 'authored');
    await writeFile(authored, 'preserved');
    await symlink(outside.path, join(folder, 'package'));
    const linked = prepareBuild(session.root, input.files, folder);
    const linkedFiles = linked.files;
    expect(() => linkedFiles.read('package/authored')).toThrow();
    expect(() => {
        linkedFiles.write('package/authored', { bytes: Buffer.from('changed'), mode: 0o600 }, undefined);
    }).toThrow();
    linkedFiles[Symbol.dispose]();
    expect(await readFile(authored, 'utf8')).toBe('preserved');
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(false);
    await rm(join(folder, 'package'));
    await mkdir(join(folder, 'package'));
    const repaired = prepareBuild(session.root, input.files, folder);
    const repairedFiles = repaired.files;
    expect(repairedFiles.read('build.lock')).toBeDefined();
    repairedFiles[Symbol.dispose]();
    expect(await isOnDisk(join(folder, 'build.lock'))).toBe(false);
});
test('the Swift build folder lives in the gspot cache, the same for one repository and different between repositories', async () => {
    await using first = await testdir();
    await using second = await testdir();
    await using _cache = await redirectCacheFolder();
    for (const root of [first.path, second.path])
        await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE });
    const session = await openSession(first.path);
    const firstInput = planSandboxCheck(session, 'swift/build');
    const checkedSession = await openSession(second.path);
    const secondInput = planSandboxCheck(checkedSession, 'swift/build');
    const folder = buildPlan(session, firstInput).folder;
    expect(folder).toBe(buildPlan(session, firstInput).folder);
    expect(folder).not.toBe(buildPlan(checkedSession, secondInput).folder);
    expect(folder.startsWith(readCacheFolder() + sep)).toBe(true);
});
test('Swift build side effects stay in the source copy and do not reach later runs', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build', {
        'Sources/Value.swift': 'let value = 1\n',
    });

    const original = join(sandbox.path, 'Sources/Value.swift');
    const initial = prepared.planned;

    const { mode } = await stat(original);
    const sources: string[] = [];
    const artifacts: boolean[][] = [];
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (_argv, options) => {
            const cwd = options.cwd;
            sources.push(await readFile(join(cwd, 'Sources/Value.swift'), 'utf8'));
            artifacts.push([await isOnDisk(join(cwd, 'Generated')), await isOnDisk(join(cwd, 'Package.resolved'))]);
            await mkdir(join(cwd, 'Generated'));
            await symlink('Generated', join(cwd, 'generated-link'), 'dir');
            await writeFile(join(cwd, 'Generated/side-effect'), 'generated');
            await writeFile(join(cwd, 'Package.resolved'), 'generated resolution');
            await writeFile(join(cwd, 'Sources/Value.swift'), 'modified by build');
            return buildProcessResult();
        }),
    );
    expect(await findBuiltInCheck('swift/build')(prepared.session, initial)).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'swift/build')).toStrictEqual([]);
    expect(sources).toStrictEqual(['let value = 1\n', 'let value = 1\n']);
    expect(artifacts).toStrictEqual([
        [false, false],
        [false, false],
    ]);
    for (const [, options] of run.mock.calls) expect(options.cwd).not.toBe(sandbox.path);
    await using originalFile = await open(original, 'r');
    expect(await originalFile.readFile('utf8')).toBe('let value = 1\n');
    const current = await originalFile.stat();
    expect(current.mode).toBe(mode);
    expect(await isOnDisk(join(sandbox.path, 'Package.resolved'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'Generated'))).toBe(false);
});
test('Periphery build side effects stay in its source copy and findings name original source paths', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/periphery', {
        'Main.swift': 'let unused = 1\n',
    });

    const input = prepared.planned;
    const sources: string[] = [];
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (_argv, options) => {
            const { cwd } = options;
            sources.push(await readFile(join(cwd, 'Main.swift'), 'utf8'));
            await writeFile(join(cwd, 'Package.resolved'), 'generated by the build');
            return buildProcessResult({ code: 1, stdout: `${cwd}/Main.swift:1:5: warning: Property unused is unused` });
        }),
    );
    expect(await findBuiltInCheck('swift/periphery')(prepared.session, input)).toMatchObject([
        { file: 'Main.swift', line: 1, column: 5, rule: 'unused' },
    ]);
    expect(sources).toStrictEqual(['let unused = 1\n']);
    expect(run.mock.calls[0]?.[1].cwd).not.toBe(sandbox.path);
    expect(await isOnDisk(join(sandbox.path, 'Package.resolved'))).toBe(false);
});
test('concurrent Swift compilation and Periphery keep separate source and build folders', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();

    await using prepared = await prepareSwiftCheck(sandbox, 'swift/build');

    const compile = prepared.planned;
    const session = await openSession(sandbox.path);
    const periphery = planSandboxCheck(session, 'swift/periphery');
    const started = Promise.withResolvers<undefined>();
    const folders: string[] = [];
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation(async (_argv, options) => {
            const { cwd } = options;
            folders.push(cwd);
            if (folders.length === 2) started.resolve();
            await started.promise;
            return buildProcessResult();
        }),
    );
    try {
        expect(
            await Promise.all([
                findBuiltInCheck('swift/build')(prepared.session, compile),
                findBuiltInCheck('swift/periphery')(session, periphery),
            ]),
        ).toStrictEqual([[], []]);
        expect(new Set(folders).size).toBe(2);
        const compilePlan = buildPlan(prepared.session, compile);
        const peripheryFolder = getScopeBuildFolder(session.installedRoot, periphery.scope.folder.path, 'periphery');
        expect(compilePlan.folder).not.toBe(peripheryFolder);
        if (compilePlan.kind !== 'package') throw new Error('Expected a Swift package build.');
        expect(compilePlan.scratch).not.toBe(peripheryFolder);
        expect(folders).toContain(join(peripheryFolder, 'source'));
    } finally {
        started.resolve();
    }
});
test('two copies of one repository with the same installed root share one build folder', async () => {
    const files = { 'gspot.toml': buildSandboxSettings(['swift']), 'Package.swift': SWIFT_PACKAGE };
    await using installed = await testdir(files);
    await using first = await testdir(files);
    await using second = await testdir(files);
    await using _cache = await redirectCacheFolder();
    const session = await openSession(installed.path);
    const installedInput = planSandboxCheck(session, 'swift/build');
    const checkedSession = await openSession(first.path, { installedRoot: installed.path });
    const firstInput = planSandboxCheck(checkedSession, 'swift/build');
    const correctedSession = await openSession(second.path, { installedRoot: installed.path });
    const secondInput = planSandboxCheck(correctedSession, 'swift/build');
    const firstFolder = buildPlan(checkedSession, firstInput).folder;
    const secondFolder = buildPlan(correctedSession, secondInput).folder;
    expect(firstFolder).toBe(secondFolder);
    expect(firstFolder).toBe(buildPlan(session, installedInput).folder);
});
