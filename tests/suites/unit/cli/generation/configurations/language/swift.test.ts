import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { CLEAN_SWIFT } from '#tests/config/swift.ts';
import { openSession } from '#cli/planning/session.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import type { SwiftlintOutput } from '#tests/types/swift.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { BUILD_SETTINGS_PBXPROJ } from '#tests/config/checks/infrastructure/xcode.ts';
import { SWIFT_PROJECT_SETTINGS } from '#tests/config/generation/configurations/language/swift.ts';

test("SwiftFormat reads each scope's Swift version from Package.swift", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift'], {
            rules: true,
            scopes: [{ path: 'nested', configurations: ['swift'] }],
        }),
        'Package.swift': '// swift-tools-version:5.9\nimport PackageDescription\n',
        'nested/Package.swift': '// swift-tools-version:6.3.2\nimport PackageDescription\n',
    });
    const session = await openSession(sandbox.path);
    const outputs = generateFiles(session).files;
    expect(outputs.find((file) => file.path === getConfigFilePath(session, 'swiftformat'))?.content).toContain(
        '--swiftversion 5.9\n',
    );
    expect(
        outputs.find((file) => file.path === getConfigFilePath(session, 'swiftformat', 'nested'))?.content,
    ).toContain('--swiftversion 6.3.2\n');
});

test('SwiftFormat uses the Xcode project you choose in each scope', async () => {
    const files = {
        'source.swift': CLEAN_SWIFT,
        'nested/source.swift': CLEAN_SWIFT,
        'disabled/source.swift': CLEAN_SWIFT,
        'gspot.toml': SWIFT_PROJECT_SETTINGS,
        'Unused.xcodeproj/project.pbxproj': 'not native plist syntax',
        'Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ,
        'nested/Chosen.xcodeproj/project.pbxproj': BUILD_SETTINGS_PBXPROJ.replace(
            'SWIFT_VERSION=6.0',
            'SWIFT_VERSION=5.5',
        ),
    };
    await using sandbox = await testdir(files);
    const session = await openSession(sandbox.path);
    const outputs = generateFiles(session).files;
    expect(outputs.find((file) => file.path === getConfigFilePath(session, 'swiftformat'))?.content).toContain(
        '--swiftversion 6.0\n',
    );
    expect(
        outputs.find((file) => file.path === getConfigFilePath(session, 'swiftformat', 'nested'))?.content,
    ).toContain('--swiftversion 5.5\n');
    expect(outputs.map(({ path }) => path).filter((path) => path.includes('disabled'))).toStrictEqual([]);
});

test.each(['lf', 'crlf'] as const)('SwiftFormat writes the %s line ending you set in each scope', async (ending) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift'], {
            level: 'all',
            tables: `[format]\nline_ending = "${ending}"\n[[scope]]\npath = "child"\nconfigurations = ["swift"]\nformat.line_ending = "${ending === 'lf' ? 'crlf' : 'lf'}"\n`,
        }),
        'Value.swift': CLEAN_SWIFT,
        'child/Value.swift': CLEAN_SWIFT,
    });

    const session = await openSession(sandbox.path);
    const files = generateFiles(session).files;
    expect(files.find((file) => file.path === getConfigFilePath(session, 'swiftformat'))!.content).toContain(
        `--linebreaks ${ending}\n`,
    );
    expect(files.find((file) => file.path === getConfigFilePath(session, 'swiftformat', 'child'))!.content).toContain(
        `--linebreaks ${ending === 'lf' ? 'crlf' : 'lf'}\n`,
    );
});

test.each(['basic', 'all'] as const)(
    'SwiftLint keeps configured limits and level-specific rules at %s',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift'], {
                level,
                tables: '[format]\nprint_width = 110\ntrailing_commas = "none"\n[limits]\nfunction_lines = 17\nfile_lines = 190\n',
            }),
            'Value.swift': CLEAN_SWIFT,
        });
        const session = await openSession(sandbox.path);
        const text = generateFiles(session).files.find(
            (file) => file.path === getConfigFilePath(session, 'swiftlint'),
        )!.content;
        const document = parse(text) as SwiftlintOutput;
        expect(document.function_body_length).toStrictEqual(level === 'all' ? { warning: 17, error: 17 } : undefined);
        expect(document.file_length).toStrictEqual(
            level === 'all' ? { warning: 190, error: 190, ignore_comment_only_lines: true } : undefined,
        );
        expect(document.line_length).toStrictEqual({ warning: 110, error: 110, ignores_urls: true });
        expect(document.trailing_comma).toStrictEqual({ mandatory_comma: false });
        expect(document.opt_in_rules.includes('force_unwrapping')).toBe(level === 'all');
        expect(document.disabled_rules.includes('file_length')).toBe(level === 'basic');
    },
);
