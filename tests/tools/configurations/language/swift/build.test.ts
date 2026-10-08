import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { buildPlan } from '#cli/checks/language/swift/public.ts';
import { useCacheDirectory } from '#tests/harness/environment.ts';
import { XCODE_PROJECT } from '#tests/config/samples/swift/xcode.ts';

// The manifest assigns compiler-backed Swift checks to macOS.
test.skipIf(!isMacos)(
    'incremental Swift builds preserve compiler state and still detect a changed source',
    async () => {
        await using sandbox = await testdir();
        await using _cache = await useCacheDirectory();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift']),
            'Package.swift':
                '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
            'Sources/Example/Value.swift': 'public let value: Int = 1\n',
        });
        const first = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        expect(await BUILT_IN_CHECKS['swift/build'].input(first)).toStrictEqual([]);
        const plan = buildPlan(first);
        const files = await Array.fromAsync(new Bun.Glob('**/Value.swift.o').scan({ cwd: plan.folder }));
        expect(files).toHaveLength(1);
        const compiledFile = join(plan.folder, files[0]!);
        const { mtimeMs: modified } = await stat(compiledFile);
        const again = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        expect(await BUILT_IN_CHECKS['swift/build'].input(again)).toStrictEqual([]);
        expect(await stat(compiledFile)).toMatchObject({ mtimeMs: modified });
        await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = "wrong"\n');
        expect(
            await BUILT_IN_CHECKS['swift/build'].input(buildCheckInput(await openSession(sandbox.path), 'swift/build')),
        ).toMatchObject([{ file: 'Sources/Example/Value.swift', line: 1, rule: 'compiler' }]);
        await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = 2\n');
        expect(
            await BUILT_IN_CHECKS['swift/build'].input(buildCheckInput(await openSession(sandbox.path), 'swift/build')),
        ).toStrictEqual([]);
    },
);
test.skipIf(!isMacos)(
    'Xcode reuses compiled objects and reports source errors without changing the project',
    async () => {
        await using sandbox = await testdir();
        await using _cache = await useCacheDirectory();
        const project = XCODE_PROJECT.replaceAll('Inspection', 'Example')
            .replace('path = Example.xctest;', 'path = Example;')
            .replaceAll('Value.swift', 'main.swift')
            .replace('children = (F1,F2,G2,);', 'children = (F1, G2,);')
            .replace(
                ' F2 = { isa = PBXFileReference; path = ValueTests.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };\n',
                '',
            )
            .replaceAll('F3', 'F2')
            .replace('; B2 = { isa = PBXBuildFile; fileRef = F2; };', ';')
            .replace('files = (B1,B2,);', 'files = (B1,);')
            .replace('wrapper.cfbundle', 'compiled.mach-o.executable')
            .replace('com.apple.product-type.bundle.unit-test', 'com.apple.product-type.tool')
            .replace(' PRODUCT_BUNDLE_IDENTIFIER = "com.example.gspot.coverage";', '')
            .replace(' GENERATE_INFOPLIST_FILE = YES; CODE_SIGNING_ALLOWED = NO;', '');
        const source = 'let value: Int = 1\nprint(value)\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift', 'xcode'], {
                tables: '[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\nxcode_destination = "platform=macOS"\n',
            }),
            'Example.xcodeproj/project.pbxproj': project,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n',
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        const first = buildCheckInput(await openSession(sandbox.path), 'swift/build');
        expect(await BUILT_IN_CHECKS['swift/build'].input(first)).toStrictEqual([]);
        const plan = buildPlan(first);
        const objects = await Array.fromAsync(new Bun.Glob('**/main.o').scan({ cwd: plan.folder }));
        expect(objects.length).toBeGreaterThan(0);
        const times = await Promise.all(
            objects.map((file) => stat(join(plan.folder, file)).then(({ mtimeMs }) => mtimeMs)),
        );
        expect(
            await BUILT_IN_CHECKS['swift/build'].input(buildCheckInput(await openSession(sandbox.path), 'swift/build')),
        ).toStrictEqual([]);
        expect(
            await Promise.all(objects.map((file) => stat(join(plan.folder, file)).then(({ mtimeMs }) => mtimeMs))),
        ).toStrictEqual(times);
        expect(await readFile(join(sandbox.path, 'main.swift'), 'utf8')).toBe(source);
        expect(await readFile(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(project);
        expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('authored content\n');
        expect(await pathExists(join(sandbox.path, 'build'))).toBe(false);
        await writeFile(join(sandbox.path, 'main.swift'), 'let value: Int = "wrong"\nprint(value)\n');
        expect(
            await BUILT_IN_CHECKS['swift/build'].input(buildCheckInput(await openSession(sandbox.path), 'swift/build')),
        ).toMatchObject([{ file: 'main.swift', line: 1, column: 18, rule: 'compiler' }]);
        await writeFile(join(sandbox.path, 'main.swift'), source);
        expect(
            await BUILT_IN_CHECKS['swift/build'].input(buildCheckInput(await openSession(sandbox.path), 'swift/build')),
        ).toStrictEqual([]);
    },
);
