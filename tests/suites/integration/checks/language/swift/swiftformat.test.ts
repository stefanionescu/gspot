import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { CLEAN_SWIFT } from '#tests/config/swift.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { SWIFT_SANDBOX } from '#tests/config/integration/checks/language/swift/sandboxes.ts';

import {
    SOURCE_HEADER,
    SWIFT_INLINE_DOCS,
    SWIFT_DOCS_SOURCE,
    FORMATTED_INLINE_DOCS,
    FORMATTED_DOCS_SOURCE,
    IMPORTED_SOURCE_REASON,
    BLOCK_COMMENT_FINDINGS,
    INLINE_COMMENT_FINDINGS,
    SPACED_COMMENT_FINDINGS,
} from '#tests/config/integration/checks/language/swift/swift.ts';

const installedSandbox = shareInstalledSandbox(SWIFT_SANDBOX);

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

        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await readFormatFindings(sandbox.path, 1, '')).toStrictEqual(
            SPACED_COMMENT_FINDINGS.map(([line, column, rule]) => ['Value.swift', line, column, rule]),
        );
    },
);

async function readFormatFindings(root: string, code: 0 | 1, scopePath: string) {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    expect(result.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(scopePath === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope: scopePath, status: code === 0 ? 'passed' : 'failed' },
    ]);
    return result.report.checks.flatMap(({ findings }) =>
        findings.map(({ file, line, column, rule }) => [file, line, column, rule]),
    );
}

test.skipIf(!hasToolBuild('swiftformat'))(
    'at level all, SwiftFormat reports and fixes Swift block comments, and an ignore in gspot.toml stops the finding',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_DOCS_SOURCE,
        });
        const root = sandbox.path;
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await readFormatFindings(root, 1, '')).toStrictEqual(
            BLOCK_COMMENT_FINDINGS.map(([line, column, rule]) => ['Value.swift', line, column, rule]),
        );
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFormatFindings(root, 0, '')).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(FORMATTED_DOCS_SOURCE);
        await writeFile(join(root, 'Value.swift'), SWIFT_DOCS_SOURCE);
        const ignored = await spawnGspot(root, [
            'ignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--reason',
            IMPORTED_SOURCE_REASON,
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(await readFormatFindings(root, 1, '')).toStrictEqual(
            SPACED_COMMENT_FINDINGS.map(([line, column, rule]) => ['Value.swift', line, column, rule]),
        );
    },
);

test.skipIf(!hasToolBuild('swiftformat'))(
    'SwiftFormat reports inline block comments at their positions and keeps the file mode and swiftformat:disable comments',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_INLINE_DOCS,
        });
        const root = sandbox.path;
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await chmod(join(root, 'Value.swift'), 0o444);
        const found = await readFormatFindings(root, 1, '');
        const { mode } = await stat(join(root, 'Value.swift'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        await chmod(join(root, 'Value.swift'), 0o644);
        expect(found).toStrictEqual(INLINE_COMMENT_FINDINGS.map(([line, rule]) => ['Value.swift', line, 1, rule]));
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--json', '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readFormatFindings(root, 0, '')).toStrictEqual([]);
        expect(await readFile(join(root, 'Value.swift'), 'utf8')).toBe(FORMATTED_INLINE_DOCS);
    },
);

test.skipIf(!hasToolBuild('swiftformat'))(
    'an ignore limited to a scope path stops SwiftFormat block-comment findings until unignore',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all', scopes: [{ path: 'nested' }] }),
            'nested/Value.swift': SWIFT_DOCS_SOURCE,
        });
        const root = sandbox.path;
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const ignored = await spawnGspot(root, [
            'ignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--paths',
            'nested/**',
            '--reason',
            IMPORTED_SOURCE_REASON,
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(await readFormatFindings(root, 1, 'nested')).toStrictEqual(
            SPACED_COMMENT_FINDINGS.map(([line, column, rule]) => ['nested/Value.swift', line, column, rule]),
        );
        const removed = await spawnGspot(root, [
            'unignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--paths',
            'nested/**',
        ]);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(await readFormatFindings(root, 1, 'nested')).toStrictEqual(
            BLOCK_COMMENT_FINDINGS.map(([line, column, rule]) => ['nested/Value.swift', line, column, rule]),
        );
    },
);
