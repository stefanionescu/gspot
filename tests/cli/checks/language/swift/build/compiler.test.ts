import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { buildPlan } from '#cli/checks/language/swift/plan.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { isMacos, isPosix } from '#tests/config/harness/platforms.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { buildFolder, openBuildCache } from '#cli/checks/language/swift/cache.ts';
import { swiftBuild, swiftlintAnalyze } from '#cli/checks/language/swift/build.ts';
import { rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { rejection, containing, textContaining } from '#tests/harness/expectations.ts';

test('a silent successful Swift build returns no findings', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await swiftBuild(input)).toStrictEqual([]);
    } finally {
        run.mockRestore();
    }
});

test.skipIf(!isMacos)(
    'a failed Swift build without source diagnostics returns execution exit 2 and recovers',
    async () => {
        await using sandbox = await testdir();
        using _executables = mockPinnedExecutables(
            [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
        );
        using resources = new DisposableStack();
        resources.defer(() => {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift']),
            'Main.swift': 'let value = 1\n',
            'Package.swift':
                '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
        });
        const options = buildRunOptions({ only: ['swift/build'] });
        const initial = await openSession(sandbox.path);
        const corrected = await openSession(sandbox.path);
        const run = spyOn(spawn, 'run').mockResolvedValue({
            code: 7,
            stdout: 'Compiler startup failed',
            stderr: 'Permission denied',
            missing: false,
            duration: 1,
        });
        try {
            const failed = await executeRun(initial, options);
            expect(failed.report.exitCode).toBe(2);
            expect(failed.report.checks).toContainEqual(
                containing({
                    check: 'swift/build',
                    status: 'error',
                    findings: [],
                    note: textContaining('Permission denied'),
                }),
            );
            run.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
            const executed = await executeRun(corrected, options);
            expect(executed.report.exitCode).toBe(0);
            expect(readFileSync(join(sandbox.path, 'Main.swift'), 'utf8')).toBe('let value = 1\n');
        } finally {
            run.mockRestore();
        }
    },
);

test('a later Swift session reads a failed build after an earlier successful build', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const first = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    const second = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({
            code: 1,
            stdout: '',
            stderr: `${sandbox.path}/Main.swift:4:2: error: Missing value`,
            missing: false,
            duration: 1,
        });
    try {
        expect(await swiftBuild(first)).toStrictEqual([]);
        expect(await swiftBuild(first)).toStrictEqual([]);
        expect(await swiftBuild(second)).toStrictEqual([
            {
                check: 'swift/build',
                file: 'Main.swift',
                line: 4,
                column: 2,
                rule: 'compiler',
                message: 'Missing value',
                fixable: false,
            },
        ]);
    } finally {
        run.mockRestore();
    }
});

test('canceled Swift compilation refuses to launch the compiler', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['swift']) });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    input.cancelSignal = AbortSignal.abort();
    expect(await rejection(swiftBuild(input))).toBe('The command was canceled.');
    const analyzer = buildPlan(input, 'analyze');
    mkdirSync(analyzer.scratch!, { recursive: true });
    const state = join(analyzer.scratch!, 'state');
    writeFileSync(state, 'retained compiler state');
    expect(await rejection(swiftlintAnalyze(input))).toBe('The command was canceled.');
    expect(readFileSync(state, 'utf8')).toBe('retained compiler state');
});

test('Swift response files stay inside the compiler cache before log publication', async () => {
    await using sandbox = await testdir();
    using _executables = mockPinnedExecutables(
        [...configurationManifests().values()].flatMap((manifest) => manifest.tools),
    );
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift']),
        'external-response': 'external bytes must not enter a compiler log',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    const plan = buildPlan(input);
    const corrected = buildCheckInput(await openSession(sandbox.path), 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 0,
        stdout: `swiftc @${join(sandbox.path, 'external-response')}`,
        stderr: '',
        missing: false,
        duration: 1,
    });
    try {
        await rejection(swiftBuild(input));
        expect(existsSync(plan.log)).toBe(false);
        const response = join(plan.folder, 'sources');
        writeFileSync(response, 'Sources/Main.swift\nSources/Owner.swift\n');
        run.mockResolvedValue({ code: 0, stdout: `swiftc @${response}`, stderr: '', missing: false, duration: 1 });
        expect(await swiftBuild(corrected)).toStrictEqual([]);
        expect(readFileSync(plan.log, 'utf8')).toContain('swiftc Sources/Main.swift Sources/Owner.swift');
        expect(readFileSync(join(sandbox.path, 'external-response'), 'utf8')).toBe(
            'external bytes must not enter a compiler log',
        );
    } finally {
        run.mockRestore();
    }
});

test('a failed Swift source preparation releases its build claim before a later writer', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    resources.defer(() => {
        rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift']),
        'Main.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'swift/build');
    const plan = buildPlan(input);
    rmSync(join(sandbox.path, 'Main.swift'));
    using run = spyOn(spawn, 'run');
    expect(await rejection(swiftBuild(input))).toContain('ENOENT');
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(join(plan.folder, 'build.lock'))).toBe(false);
    const next = openBuildCache(plan.folder);
    next.close();
    expect(existsSync(join(plan.folder, 'build.lock'))).toBe(false);
});

test.skipIf(!isPosix)(
    'Swift compiler diagnostics normalize macOS private prefixes in authored source paths',
    async () => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        resources.defer(() => {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift']),
            'Main.swift': 'let value = 1\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'swift/build');
        resources.use(mockPinnedExecutables([...session.manifests.values()].flatMap((manifest) => manifest.tools)));
        resources.use(
            spyOn(spawn, 'run').mockImplementation(() => {
                const normalized = sandbox.path.replace(/^\/private/u, '');
                return Promise.resolve({
                    code: 1,
                    stdout: '',
                    stderr: `/private${normalized}/Main.swift:4:2: error: Missing value`,
                    missing: false,
                    duration: 1,
                });
            }),
        );
        expect(await swiftBuild(input)).toStrictEqual([
            containing({ file: 'Main.swift', line: 4, column: 2, rule: 'compiler', message: 'Missing value' }),
        ]);
    },
);

test.each(['default', 'platform=macOS', ''])(
    'Xcode build plans retain destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const declared = destination === 'default' ? '' : `destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift', 'xcode'], {
                tables: `[tools.xcode]\nproject = "App.xcodeproj"\nscheme = "App"\n${declared}`,
            }),
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        const expected =
            destination === 'default'
                ? (configurationManifests()
                      .get('xcode')!
                      .settings.find(({ name }) => name === 'tools.xcode.destination')!.default as string)
                : destination;
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const { argv } = buildPlan(input, purpose);
            expect(argv[argv.indexOf('-destination') + 1]).toStrictEqual(expected);
            expect(argv[argv.indexOf('-scheme') + 1]).toBe('App');
            expect(argv).toContain('App.xcodeproj');
        }
    },
);
