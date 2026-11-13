import { expect, test } from 'bun:test';

import { GROUPED_PBXPROJ } from '#tests/config/setup/configurations.ts';
import { NAMED_TARGET_SOURCE, NATIVE_TARGET_SOURCE } from '#tests/config/setup/languages.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const SWIFT_LAYER_RULES = `[[import_rule]]
name = "core"
paths = ["Core/**", "Package.swift"]

[[import_rule]]
name = "feature"
paths = ["Feature/**"]

[[import_rule]]
name = "app"
paths = ["App/**"]
`;

test('Swift imports follow the import rules through the SwiftPM targets, and a file outside every rule is reported', async () => {
    await using sandbox = await createGitSandbox({
        'Package.swift': `// swift-tools-version:5.9
import PackageDescription
let package = Package(
    name: "App",
    targets: [
        .target(name: "Core"),
        .target(name: "Feature", dependencies: ["Core"], path: "Sources/FeatureKit"),
        .testTarget(name: "CoreTests", dependencies: ["Core"]),
    ]
)
`,
        'Sources/Core/Model.swift': 'import Foundation\nimport Feature\npublic struct Model {}\n',
        'Sources/FeatureKit/View.swift': 'import Core\npublic struct View {}\n',
        'Sources/Loose/Helper.swift': 'public struct Helper {}\n',
        'Tests/CoreTests/ModelTests.swift': 'import Core\n',
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: `[[import_rule]]
name = "core"
paths = ["Sources/Core/**"]

[[import_rule]]
name = "feature"
paths = ["Sources/FeatureKit/**"]
`,
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'Sources/Loose/Helper.swift',
            line: 1,
            rule: 'uncovered-file',
            message: expect.any(String) as string,
        },
        {
            file: 'Sources/Core/Model.swift',
            line: 2,
            rule: 'refused-import',
            message: expect.stringMatching(/\bcore\b.+\bFeature\b/u) as string,
        },
    ]);
});

test('an Xcode native target is a Swift module named after the target', async () => {
    await using sandbox = await createGitSandbox({
        'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ.replace(NATIVE_TARGET_SOURCE, () => NAMED_TARGET_SOURCE),
        'First Group/Shared.swift': 'public struct Shared {}\n',
        'Root.swift': 'public struct Root {}\n',
        'Tools/Script.swift': 'import App_Kit\n',
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[[import_rule]]\nname = "tools"\npaths = ["Tools/**"]\n\n[[import_rule]]\nname = "app"\npaths = ["First Group/**", "Root.swift"]\n',
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Tools/Script.swift', line: 1, rule: 'refused-import' },
    ]);
});

test('a Swift file reports the first use of each type from a rule it may not import, with no import line', async () => {
    await using sandbox = await createGitSandbox({
        'App/Service.swift': [
            'public class Service {}',
            'public protocol Tracking {}',
            'public typealias Token = String',
            'public actor Worker {}',
            'public struct Keyed {}',
            'public struct Main { let model: Model }',
        ].join('\n'),
        'Core/Model.swift': [
            'public struct Model {',
            '    let first: Service',
            '    let second: Service',
            '    func run() -> String { Worker.start(Token()) }',
            String.raw`    let path = \Keyed.value`,
            '}',
            'extension Tracking {}',
        ].join('\n'),
        'gspot.toml': buildSandboxSettings(['swift'], { tables: SWIFT_LAYER_RULES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    const refused = (name: string): string =>
        expect.stringMatching(new RegExp(String.raw`"core".+\b${name} from rule "app"`, 'u')) as string;
    expect(
        findings.map(({ file, line, column, rule, message }) => ({ file, line, column, rule, message })),
    ).toStrictEqual([
        { file: 'Core/Model.swift', line: 2, column: 16, rule: 'refused-import', message: refused('Service') },
        { file: 'Core/Model.swift', line: 4, column: 28, rule: 'refused-import', message: refused('Worker') },
        { file: 'Core/Model.swift', line: 4, column: 41, rule: 'refused-import', message: refused('Token') },
        { file: 'Core/Model.swift', line: 5, column: 17, rule: 'refused-import', message: refused('Keyed') },
        { file: 'Core/Model.swift', line: 7, column: 11, rule: 'refused-import', message: refused('Tracking') },
    ]);
});

test('a Swift name that the rules declare for a narrower reach reports nothing, and a real use beside it does', async () => {
    await using sandbox = await createGitSandbox({
        'App/Names.swift': [
            ...['Associated', 'Both', 'Nested', 'Param', 'Real', 'Row', 'Style', 'Target'].map(
                (name) => `public struct ${name} {}`,
            ),
            'public struct Outer { public struct Inner {} }',
            'private struct Sealed {}',
        ].join('\n'),
        'App/Tests/Fixture.swift': 'public struct Fixture {}\n',
        'App/Vendor/Library.swift': 'public struct Library {}\n',
        '.gitattributes': 'App/Vendor/** linguist-vendored\n',
        'Core/Names.swift': [
            'public struct Holder<Param> {',
            '    public struct Nested {}',
            '    public let nested: Nested',
            '    public let param: Param',
            '}',
            'public protocol Source {',
            '    associatedtype Associated',
            '    func read() -> Associated',
            '}',
            'public struct Both {}',
            'private struct Row {}',
            'public func run() -> Real {',
            '    _ = [Both(), Row(), Sealed(), Inner(), Fixture(), Library()]',
            '}',
        ].join('\n'),
        'Feature/Screen.swift': 'public final class Screen: Base { let style: Style }\n',
        'Core/Base.swift': 'open class Base { public struct Style {} }\n',
        'Package.swift': 'let package = Package(name: "Sample", targets: [Target.target(name: "Sample")])\n',
        'gspot.toml': buildSandboxSettings(['swift'], { tables: SWIFT_LAYER_RULES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'Core/Names.swift',
            line: 12,
            rule: 'refused-import',
            message: expect.stringMatching(/\bReal from rule "app"/u) as string,
        },
    ]);
});

test('a Swift identifier that names no type reports nothing, and a real use beside it does', async () => {
    await using sandbox = await createGitSandbox({
        'App/Names.swift': [
            'Argument',
            'Binding',
            'Case',
            'Dotted',
            'Entry',
            'Flag',
            'Label',
            'Member',
            'Module',
            'Preview',
            'Real',
            'lower',
        ]
            .map((name) => `public struct ${name} {}`)
            .join('\n'),
        'Core/Names.swift': [
            'import Module',
            '#if Flag',
            'public struct Holder<Value> {}',
            '#endif',
            'public enum Choice { case Entry }',
            '#Preview { Holder<Int>() }',
            'public func run(holder: Holder<Int>, Label value: Int) -> Real {',
            '    let lower = holder.Member',
            '    let choice: Choice = .Member',
            '    let dotted: Holder<Int>.Dotted? = nil',
            '    _ = pick(Argument: lower)',
            '    if case .Case = choice {}',
            '    let Binding = choice',
            '}',
        ].join('\n'),
        'gspot.toml': buildSandboxSettings(['swift'], { tables: SWIFT_LAYER_RULES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'Core/Names.swift',
            line: 7,
            rule: 'refused-import',
            message: expect.stringMatching(/\bReal from rule "app"/u) as string,
        },
    ]);
});

test("a Swift rule's types come from its paths, so a type outside the scope of the using file still counts", async () => {
    await using sandbox = await createGitSandbox({
        'Shared/Thing.swift': 'public struct Thing { let model: Model }\n',
        'ios/Core/Model.swift': 'public struct Model { let thing: Thing }\n',
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'ios', configurations: ['swift'] }],
            tables: '[[import_rule]]\nname = "core"\npaths = ["ios/Core/**"]\n\n[[import_rule]]\nname = "shared"\npaths = ["Shared/**"]\ncan_import = []\n',
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules', { scope: 'ios' });
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'ios/Core/Model.swift', line: 1, rule: 'refused-import' },
    ]);
});
