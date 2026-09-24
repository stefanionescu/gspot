import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import * as spawn from '#cli/platform/spawn.ts';
import { executeRun } from '#cli/run/execute.ts';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import type { EngineInput } from '#cli/run/engines.ts';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { swiftAnalyze, swiftBuild, swiftPeriphery } from '#cli/checks/swift/build.ts';
import { rmSync, existsSync, mkdirSync, symlinkSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const caches = new Set<string>();
afterEach(() => {
    for (const folder of caches) rmSync(folder, { recursive: true, force: true });
    caches.clear();
});

async function inputFor(root: string, check: string): Promise<EngineInput> {
    caches.add(buildFolder(root));
    const session = await openSession(root);
    const selection = session.scopes[0]!;
    const spec = selection.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === check)!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}

test.each([0, 7])('a silent Swift build with exit %i retains its verdict', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({ code, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        if (code === 0) expect(await swiftBuild(input)).toStrictEqual([]);
        else
            await expect(swiftBuild(input)).rejects.toThrow(
                `The Swift build exited ${String(code)} without source diagnostics.`,
            );
    } finally {
        run.mockRestore();
    }
});

test('a failed Swift build without source diagnostics returns execution exit 2 and recovers', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Main.swift': 'let value = 1\n',
        'Package.swift':
            '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
    });
    caches.add(buildFolder(sandbox.path));
    const options = {
        stage: 'all' as const,
        only: ['swift/build'],
        skips: [],
        noCache: true,
        fix: false,
        isDryRun: false,
    };
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
            expect.objectContaining({
                check: 'swift/build',
                status: 'error',
                findings: [],
                note: expect.stringContaining('Permission denied'),
            }),
        );
        run.mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
        expect((await executeRun(corrected, options)).report.exitCode).toBe(0);
        expect(readFileSync(join(sandbox.path, 'Main.swift'), 'utf8')).toBe('let value = 1\n');
    } finally {
        run.mockRestore();
    }
});

test('a later Swift session observes a failed build after an earlier successful build', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const first = await inputFor(sandbox.path, 'swift/build');
    const second = await inputFor(sandbox.path, 'swift/build');
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

test('Swift compiler diagnostics retain their source location on a failed build', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: '/project/Main.swift:4:2: error: Missing value',
        missing: false,
        duration: 1,
    });
    try {
        expect(await swiftBuild(input)).toMatchObject([
            { file: '/project/Main.swift', line: 4, column: 2, message: 'Missing value' },
        ]);
    } finally {
        run.mockRestore();
    }
});

test('analysis refuses an incomplete compiler log after a failed build', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 7, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        await rejects(swiftAnalyze(input), /build exited 7/u);
    } finally {
        run.mockRestore();
    }
});

test.each([0, 7])('a silent SwiftLint analyzer with exit %i retains its verdict', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        if (code === 0) expect(await swiftAnalyze(input)).toStrictEqual([]);
        else await rejects(swiftAnalyze(input), new RegExp(`analyzer exited ${String(code)}`, 'u'));
    } finally {
        run.mockRestore();
    }
});

test.each(['build', 'analyzer'])('a timed-out Swift %s reports an error', async (step) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const run = spyOn(spawn, 'run');
    if (step === 'analyzer')
        run.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    run.mockResolvedValue({ code: 1, stdout: '', stderr: '', missing: false, duration: 1, isTimedOut: true });
    try {
        await rejects(swiftAnalyze(input), /ran past 600 seconds and was stopped/u);
    } finally {
        run.mockRestore();
    }
});

test('incremental Swift builds preserve compiler state and still detect a changed source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Package.swift':
            '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
        'Sources/Example/Value.swift': 'public let value: Int = 1\n',
    });
    const first = await inputFor(sandbox.path, 'swift/build');
    const start = performance.now();
    expect(await swiftBuild(first)).toStrictEqual([]);
    const initialMs = performance.now() - start;
    const plan = swiftBuildPlan(first);
    const files = [...new Bun.Glob('**/Value.swift.o').scanSync({ cwd: plan.folder })];
    expect(files).toHaveLength(1);
    const object = join(plan.folder, files[0]!);
    const modified = statSync(object).mtimeMs;
    const again = await inputFor(sandbox.path, 'swift/build');
    const repeatedStart = performance.now();
    expect(await swiftBuild(again)).toStrictEqual([]);
    const repeatedMs = performance.now() - repeatedStart;
    expect(statSync(object).mtimeMs).toBe(modified);
    console.log(`Swift compile: initial ${initialMs.toFixed(0)} ms; unchanged ${repeatedMs.toFixed(0)} ms`);
    writeFileSync(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = "wrong"\n');
    expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toMatchObject([
        { file: 'Sources/Example/Value.swift', line: 1, rule: 'compiler' },
    ]);
}, 120_000);

test.skipIf(process.platform !== 'darwin')(
    'Xcode reuses compiled objects and reports source errors without changing the project',
    async () => {
        await using sandbox = await testdir();
        const project = `// !$*UTF8*$!
{
    archiveVersion = 1;
    objectVersion = 56;
    rootObject = P1;
    objects = {
        P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
        G1 = { isa = PBXGroup; children = (F1, G2,); sourceTree = "<group>"; };
        G2 = { isa = PBXGroup; name = Products; children = (F2,); sourceTree = "<group>"; };
        F1 = { isa = PBXFileReference; path = main.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
        F2 = { isa = PBXFileReference; path = Example; explicitFileType = "compiled.mach-o.executable"; sourceTree = BUILT_PRODUCTS_DIR; };
        B1 = { isa = PBXBuildFile; fileRef = F1; };
        S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,); runOnlyForDeploymentPostprocessing = 0; };
        T1 = { isa = PBXNativeTarget; name = Example; productName = Example; productReference = F2; productType = "com.apple.product-type.tool"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
        C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
        C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
        D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
        D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Example; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; }; };
    };
}
`;
        const source = 'let value: Int = 1\nprint(value)\n';
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nconfigurations = ["swift", "xcode"]\n[tools.xcode]\nproject = "Example.xcodeproj"\nscheme = "Example"\ndestination = "platform=macOS"\n',
            'Example.xcodeproj/project.pbxproj': project,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n',
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        const first = await inputFor(sandbox.path, 'swift/build');
        expect(await swiftBuild(first)).toStrictEqual([]);
        const plan = swiftBuildPlan(first);
        const objects = [...new Bun.Glob('derived/**/main.o').scanSync({ cwd: plan.folder })];
        expect(objects.length).toBeGreaterThan(0);
        const times = objects.map((file) => statSync(join(plan.folder, file)).mtimeMs);
        expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toStrictEqual([]);
        expect(objects.map((file) => statSync(join(plan.folder, file)).mtimeMs)).toStrictEqual(times);
        expect(readFileSync(join(sandbox.path, 'main.swift'), 'utf8')).toBe(source);
        expect(readFileSync(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(project);
        expect(readFileSync(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('authored content\n');
        expect(existsSync(join(sandbox.path, 'build'))).toBe(false);
        writeFileSync(join(sandbox.path, 'main.swift'), 'let value: Int = "wrong"\nprint(value)\n');
        expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toMatchObject([
            { file: 'main.swift', line: 1, column: 18, rule: 'compiler' },
        ]);
        writeFileSync(join(sandbox.path, 'main.swift'), source);
        expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toStrictEqual([]);
    },
    120_000,
);

test('manual analysis clears its own compiler state without consuming the incremental build result', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/swiftlint-analyze');
    const compile = swiftBuildPlan(input);
    const analyzer = swiftBuildPlan(input, 'analyze');
    const compilerState = join(compile.folder, 'package', 'state');
    const analyzerState = join(analyzer.scratch!, 'state');
    mkdirSync(join(compile.folder, 'package'), { recursive: true });
    mkdirSync(analyzer.scratch!, { recursive: true });
    writeFileSync(compilerState, 'incremental');
    writeFileSync(analyzerState, 'old analyzer');
    const run = spyOn(spawn, 'run')
        .mockResolvedValueOnce({ code: 0, stdout: 'incremental log', stderr: '', missing: false, duration: 1 })
        .mockResolvedValueOnce({ code: 0, stdout: 'complete compiler log', stderr: '', missing: false, duration: 1 })
        .mockResolvedValue({ code: 0, stdout: '', stderr: '', missing: false, duration: 1 });
    try {
        expect(await swiftBuild(input)).toStrictEqual([]);
        expect(await swiftAnalyze(input)).toStrictEqual([]);
        expect(readFileSync(compilerState, 'utf8')).toBe('incremental');
        expect(existsSync(analyzerState)).toBe(false);
        expect(readFileSync(analyzer.log, 'utf8')).toContain('complete compiler log');
        expect(readFileSync(compile.log, 'utf8')).toContain('incremental log');
    } finally {
        run.mockRestore();
    }
});

test('canceled Swift compilation refuses to launch the compiler', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const input = await inputFor(sandbox.path, 'swift/build');
    input.cancelSignal = AbortSignal.abort();
    await rejects(swiftBuild(input), { message: 'The command was canceled.' });
    const analyzer = swiftBuildPlan(input, 'analyze');
    mkdirSync(analyzer.scratch!, { recursive: true });
    const state = join(analyzer.scratch!, 'state');
    writeFileSync(state, 'retained compiler state');
    await rejects(swiftAnalyze(input), { message: 'The command was canceled.' });
    expect(readFileSync(state, 'utf8')).toBe('retained compiler state');
});

test('Swift response files stay inside the compiler cache before log publication', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'external-response': 'external bytes must not enter a compiler log',
    });
    const input = await inputFor(sandbox.path, 'swift/build');
    const plan = swiftBuildPlan(input);
    const corrected = await inputFor(sandbox.path, 'swift/build');
    const run = spyOn(spawn, 'run').mockResolvedValue({
        code: 0,
        stdout: `swiftc @${join(sandbox.path, 'external-response')}`,
        stderr: '',
        missing: false,
        duration: 1,
    });
    try {
        await expect(swiftBuild(input)).rejects.toThrow();
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

test('Swift build side effects stay in the source copy and do not become later inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Sources/Value.swift': 'let value = 1\n',
    });
    const original = join(sandbox.path, 'Sources/Value.swift');
    const initial = await inputFor(sandbox.path, 'swift/build');
    const next = await inputFor(sandbox.path, 'swift/build');
    const mode = statSync(original).mode;
    let calls = 0;
    const run = spyOn(spawn, 'run').mockImplementation(async (_argv, options) => {
        const cwd = options.cwd;
        expect(cwd).not.toBe(sandbox.path);
        expect(readFileSync(join(cwd, 'Sources/Value.swift'), 'utf8')).toBe('let value = 1\n');
        expect(existsSync(join(cwd, 'Generated'))).toBe(false);
        expect(existsSync(join(cwd, 'Package.resolved'))).toBe(false);
        mkdirSync(join(cwd, 'Generated'));
        symlinkSync('Generated', join(cwd, 'generated-link'), 'dir');
        writeFileSync(join(cwd, 'Generated/side-effect'), 'generated');
        writeFileSync(join(cwd, 'Package.resolved'), 'generated resolution');
        writeFileSync(join(cwd, 'Sources/Value.swift'), 'modified by build');
        calls += 1;
        return { code: 0, stdout: '', stderr: '', missing: false, duration: 1 };
    });
    try {
        expect(await swiftBuild(initial)).toStrictEqual([]);
        expect(await swiftBuild(next)).toStrictEqual([]);
        expect(calls).toBe(2);
        expect(readFileSync(original, 'utf8')).toBe('let value = 1\n');
        expect(statSync(original).mode).toBe(mode);
        expect(existsSync(join(sandbox.path, 'Package.resolved'))).toBe(false);
        expect(existsSync(join(sandbox.path, 'Generated'))).toBe(false);
    } finally {
        run.mockRestore();
    }
});

test('Periphery build side effects stay in its source copy and findings name original source paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Main.swift': 'let unused = 1\n',
    });
    const input = await inputFor(sandbox.path, 'swift/periphery');
    const run = spyOn(spawn, 'run').mockImplementation(async (_argv, options) => {
        const cwd = options?.cwd;
        if (cwd === undefined) throw new Error('Periphery requires a working directory.');
        expect(cwd).not.toBe(sandbox.path);
        expect(readFileSync(join(cwd, 'Main.swift'), 'utf8')).toBe('let unused = 1\n');
        writeFileSync(join(cwd, 'Package.resolved'), 'generated by the build');
        return {
            code: 1,
            stdout: `${cwd}/Main.swift:1:5: warning: Property unused is unused`,
            stderr: '',
            missing: false,
            duration: 1,
        };
    });
    try {
        expect(await swiftPeriphery(input)).toMatchObject([{ file: 'Main.swift', line: 1, column: 5, rule: 'unused' }]);
        expect(existsSync(join(sandbox.path, 'Package.resolved'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'Main.swift'), 'utf8')).toBe('let unused = 1\n');
    } finally {
        run.mockRestore();
    }
});

test('concurrent Swift compilation and Periphery retain separate source and artifact directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n' });
    const compile = await inputFor(sandbox.path, 'swift/build');
    const periphery = await inputFor(sandbox.path, 'swift/periphery');
    const started = Promise.withResolvers<void>();
    const directories: string[] = [];
    const run = spyOn(spawn, 'run').mockImplementation(async (_argv, options) => {
        const cwd = options?.cwd;
        if (cwd === undefined) throw new Error('The build requires a working directory.');
        directories.push(cwd);
        if (directories.length === 2) started.resolve();
        await started.promise;
        return { code: 0, stdout: '', stderr: '', missing: false, duration: 1 };
    });
    try {
        expect(await Promise.all([swiftBuild(compile), swiftPeriphery(periphery)])).toStrictEqual([[], []]);
        expect(new Set(directories).size).toBe(2);
    } finally {
        started.resolve();
        run.mockRestore();
    }
});

test.each(['../External.xcodeproj', '/External.xcodeproj', 'C:External.xcodeproj', String.raw`..\External.xcodeproj`])(
    'Xcode project %s cannot redirect an isolated build outside the scope',
    async (project) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nconfigurations = ["swift", "xcode"]\n[tools.xcode]\nproject = ${JSON.stringify(project)}\nscheme = "Example"\n`,
        });
        const input = await inputFor(sandbox.path, 'swift/build');
        writeFileSync(
            join(sandbox.path, 'gspot.toml'),
            'version = 1\nconfigurations = ["swift", "xcode"]\n[tools.xcode]\nproject = "Example.xcodeproj"\nscheme = "Example"\n',
        );
        const corrected = await inputFor(sandbox.path, 'swift/build');
        const run = spyOn(spawn, 'run').mockResolvedValue({
            code: 0,
            stdout: '',
            stderr: '',
            missing: false,
            duration: 1,
        });
        try {
            await expect(swiftBuild(input)).rejects.toThrow('Unsafe lifecycle path');
            expect(run).not.toHaveBeenCalled();
            expect(await swiftBuild(corrected)).toStrictEqual([]);
        } finally {
            run.mockRestore();
        }
    },
);
