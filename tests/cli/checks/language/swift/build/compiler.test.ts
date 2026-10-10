import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isolateCompilerCache } from '#tests/harness/environment.ts';
import { isMacos, isPosix } from '#tests/config/harness/platforms.ts';
import { SWIFT_PACKAGE } from '#tests/config/samples/swift/source.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { buildCheckInput, swiftBuildInput } from '#tests/harness/input.ts';
import { buildPlan, openBuildCache } from '#cli/checks/language/swift/public.ts';
import { rejection, containing, textContaining } from '#tests/harness/expectations.ts';

test('a silent successful Swift build returns no findings', async () => {
    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    const run = spyOn(spawn, 'run').mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await BUILT_IN_CALCULATIONS['swift/build'](input)).toStrictEqual([]);
    } finally {
        run.mockRestore();
    }
});

test.skipIf(!isMacos)(
    'a failed Swift build without source diagnostics returns execution exit 2 and recovers',
    async () => {
        await using sandbox = await testdir();

        const prepared = await swiftBuildInput(sandbox, 'swift/build', {
            'Main.swift': 'let value = 1\n',
            'Package.swift':
                '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
        });
        await using _preparation = prepared.resources;
        const options = buildRunOptions({ only: ['swift/build'] });
        const initial = prepared.session;
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
        } finally {
            run.mockRestore();
        }
    },
);

test('a later Swift session reads a failed build after an earlier successful build', async () => {
    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const first = prepared.input;
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
        expect(await BUILT_IN_CALCULATIONS['swift/build'](first)).toStrictEqual([]);
        expect(await BUILT_IN_CALCULATIONS['swift/build'](first)).toStrictEqual([]);
        expect(await BUILT_IN_CALCULATIONS['swift/build'](second)).toStrictEqual([
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

    const prepared = await swiftBuildInput(sandbox, 'swift/build');
    await using _preparation = prepared.resources;
    const input = prepared.input;
    input.cancelSignal = AbortSignal.abort();
    using run = spyOn(spawn, 'run');
    expect(await rejection(BUILT_IN_CALCULATIONS['swift/build'](input))).toBe('The command was canceled.');
    const analyzer = buildPlan(input, 'analyze');
    await mkdir(analyzer.scratch!, { recursive: true });
    const state = join(analyzer.scratch!, 'state');
    await writeFile(state, 'retained compiler state');
    expect(await rejection(BUILT_IN_CALCULATIONS['swift/swiftlint-analyze'](input))).toBe('The command was canceled.');
    expect(await readFile(state, 'utf8')).toBe('retained compiler state');
    expect(run).not.toHaveBeenCalled();
});

test('Swift response files stay inside the compiler cache before log publication', async () => {
    await using sandbox = await testdir();

    const prepared = await swiftBuildInput(sandbox, 'swift/build', {
        'external-response': 'external bytes must not enter a compiler log',
    });
    await using _preparation = prepared.resources;
    const input = prepared.input;
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
        expect(await rejection(BUILT_IN_CALCULATIONS['swift/build'](input))).toContain('Unsafe lifecycle path:');
        expect(await pathExists(plan.log)).toBe(false);
        const response = join(plan.folder, 'sources');
        await writeFile(response, 'Sources/Main.swift\nSources/Owner.swift\n');
        run.mockResolvedValue({ code: 0, stdout: `swiftc @${response}`, stderr: '', missing: false, duration: 1 });
        expect(await BUILT_IN_CALCULATIONS['swift/build'](corrected)).toStrictEqual([]);
        expect(await readFile(plan.log, 'utf8')).toContain('swiftc Sources/Main.swift Sources/Owner.swift');
    } finally {
        run.mockRestore();
    }
});

test('a failed Swift source preparation releases its build claim before a later writer', async () => {
    await using sandbox = await testdir();
    await using _cache = await isolateCompilerCache();
    await createFileTree(sandbox.path, {
        'Package.swift': SWIFT_PACKAGE,
        'gspot.toml': buildPolicy(['swift']),
        'Main.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'swift/build');
    const plan = buildPlan(input);
    await rm(join(sandbox.path, 'Main.swift'));
    using run = spyOn(spawn, 'run');
    expect(await rejection(BUILT_IN_CALCULATIONS['swift/build'](input))).toContain('ENOENT');
    expect(run).not.toHaveBeenCalled();
    expect(await pathExists(join(plan.folder, 'build.lock'))).toBe(false);
    {
        using next = openBuildCache(plan.folder);
        expect(next.read('build.lock')).toBeDefined();
    }
    expect(await pathExists(join(plan.folder, 'build.lock'))).toBe(false);
});

test.skipIf(!isPosix)(
    'Swift compiler diagnostics normalize macOS private prefixes in authored source paths',
    async () => {
        await using sandbox = await testdir();
        const prepared = await swiftBuildInput(sandbox, 'swift/build', { 'Main.swift': 'let value = 1\n' });
        await using _preparation = prepared.resources;
        const input = prepared.input;
        using _run = spyOn(spawn, 'run').mockImplementation(() => {
            const normalized = sandbox.path.replace(/^\/private/u, '');
            return Promise.resolve({
                code: 1,
                stdout: '',
                stderr: `/private${normalized}/Main.swift:4:2: error: Missing value`,
                missing: false,
                duration: 1,
            });
        });
        expect(await BUILT_IN_CALCULATIONS['swift/build'](input)).toStrictEqual([
            containing({ file: 'Main.swift', line: 4, column: 2, rule: 'compiler', message: 'Missing value' }),
        ]);
    },
);

test.each(['default', 'platform=macOS', ''])(
    'Xcode build plans retain destination %s for every build purpose',
    async (destination) => {
        await using sandbox = await testdir();
        const declared = destination === 'default' ? '' : `xcode_destination = ${JSON.stringify(destination)}\n`;
        await createFileTree(sandbox.path, {
            'Package.swift': SWIFT_PACKAGE,
            'gspot.toml': buildPolicy(['swift', 'xcode'], {
                tables: `[swift]\nxcode_project = "App.xcodeproj"\nxcode_scheme = "App"\n${declared}`,
            }),
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        const expected =
            destination === 'default'
                ? configurationManifests()
                      .get('swift')!
                      .settings.find(({ name }) => name === 'swift.xcode_destination')!.default
                : destination;
        for (const purpose of ['compile', 'analyze', 'coverage'] as const) {
            const { argv } = buildPlan(input, purpose);
            expect(expected).toBe(argv[argv.indexOf('-destination') + 1]);
            expect(argv[argv.indexOf('-scheme') + 1]).toBe('App');
            expect(argv).toContain('App.xcodeproj');
        }
    },
);
