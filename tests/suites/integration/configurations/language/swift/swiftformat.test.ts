import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/cli/tools.ts';
import { CLEAN_SWIFT } from '#tests/config/setup/languages.ts';
import { SWIFT_SANDBOX } from '#tests/config/integration/swift.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { changeSandbox, applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';

const INLINE_COMMENT_FINDINGS = [
    [4, 'blockComments'],
    [4, 'docComments'],
    [5, 'blankLinesBetweenScopes'],
    [7, 'blockComments'],
    [7, 'docComments'],
    [8, 'blockComments'],
    [8, 'docComments'],
    [11, 'blockComments'],
] as const;

const FORMATTED_INLINE_DOCS = `/// A choice.
public enum Choice {
    /// The first choice.
    case one // Inline documentation.
}

/// A literal.
public let example = "/** literal */" // After a string.
/** Ordinary comment. */ // After a comment.
/// An inline /** example */ remains documentation.
public let value = "safe"
// Ordinary* nested comment.
// swiftformat:disable:next blockComments - An external declaration retains its layout.
/** A retained declaration. */
public let preserved = "fixed"
`;

const SWIFT_DOCS_SOURCE = `/** Parses a sample value. */
public func parsed(_ value: String) -> Int {
    Int(value) ?? 0
}

/// The literal /** example */ is documentation syntax.
public let example = "/** not documentation */"

/* Ordinary comment with a nested /** comment */ inside. */
`;

const SWIFT_INLINE_DOCS = `/// A choice.
public enum Choice {
    /// The first choice.
    case one /** Inline documentation. */
}
/// A literal.
public let example = "/** literal */" /** After a string. */
/* Ordinary comment. */ /** After a comment. */
/// An inline /** example */ remains documentation.
public let value = "safe"
/* Ordinary /** nested */ comment. */
// swiftformat:disable:next blockComments - An external declaration retains its layout.
/** A retained declaration. */
public let preserved = "fixed"
`;

const SOURCE_HEADER = `// Greeting.swift
// Created by Alex Garcia.
// Copyright 2026 Example Contributors.

`;

const FORMATTED_DOCS_SOURCE = `/// Parses a sample value.
public func parsed(_ value: String) -> Int {
    Int(value) ?? 0
}

/// The literal /** example */ is documentation syntax.
public let example = "/** not documentation */"

// Ordinary comment with a nested* comment inside.
`;

const BLOCK_COMMENT_FINDINGS = [
    [1, 1, 'blockComments'],
    [9, 1, 'blockComments'],
] as const;

const SPACED_COMMENT_FINDINGS = [
    [9, 1, 'docComments'],
    [9, 1, 'spaceInsideComments'],
] as const;

const installedSandbox = shareInstalledSandbox(SWIFT_SANDBOX);

async function readFormatFindings(root: string, code: 0 | 1) {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    expect(result.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: code === 0 ? 'passed' : 'failed' },
    ]);
    return result.report.checks.flatMap(({ findings }) =>
        findings.map(({ file, line, column, rule }) => [file, line, column, rule]),
    );
}

test.skipIf(!hasToolBuild('swiftformat'))('swiftformat keeps the source header when it fixes spacing', async () => {
    const { root } = installedSandbox();
    const path = join(root, 'Sources/App/Greeting.swift');
    await using _change = await changeSandbox(installedSandbox(), {
        files: {
            'Sources/App/Greeting.swift': SOURCE_HEADER + CLEAN_SWIFT.replace('func greeting', 'func   greeting'),
        },
    });
    const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(SOURCE_HEADER + CLEAN_SWIFT);
});

test.skipIf(!hasToolBuild('swiftformat'))(
    'at level basic, SwiftFormat leaves Swift block comments unchecked',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'basic' }),
            'Value.swift': SWIFT_DOCS_SOURCE,
        });

        await applyGeneratedFiles(sandbox.path);
        expect(await readFormatFindings(sandbox.path, 1)).toStrictEqual(
            SPACED_COMMENT_FINDINGS.map(([line, column, rule]) => ['Value.swift', line, column, rule]),
        );
    },
);

test.skipIf(!hasToolBuild('swiftformat'))(
    'at level all, SwiftFormat reports and fixes Swift block comments',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_DOCS_SOURCE,
        });
        const root = sandbox.path;
        await applyGeneratedFiles(root);
        expect(await readFormatFindings(root, 1)).toStrictEqual(
            BLOCK_COMMENT_FINDINGS.map(([line, column, rule]) => ['Value.swift', line, column, rule]),
        );
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFormatFindings(root, 0)).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(FORMATTED_DOCS_SOURCE);
    },
);

test.skipIf(!hasToolBuild('swiftformat'))(
    'SwiftFormat reports inline block comments at their positions and keeps the swiftformat:disable comments',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_INLINE_DOCS,
        });
        const root = sandbox.path;
        await applyGeneratedFiles(root);
        const found = await readFormatFindings(root, 1);
        expect(found).toStrictEqual(INLINE_COMMENT_FINDINGS.map(([line, rule]) => ['Value.swift', line, 1, rule]));
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFormatFindings(root, 0)).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(FORMATTED_INLINE_DOCS);
    },
);
