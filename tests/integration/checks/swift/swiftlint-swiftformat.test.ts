import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { hasToolBuild } from '#tests/setup/system.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { stat, chmod, readFile } from 'node:fs/promises';
import { checkChanges } from '#tests/setup/sample-checks.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { SWIFT_FORMAT_CHECK } from '#tests/data/checks/swift/projects.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    CAST_SWIFT,
    CLEAN_SWIFT,
    SOURCE_HEADER,
    SWIFT_SANDBOX,
    SWIFT_DOCS_SOURCE,
    SWIFT_INLINE_DOCS,
} from '#tests/data/checks/swift/lint.ts';

const installedSandbox = registerSharedSandbox(SWIFT_SANDBOX);

test.skipIf(!hasToolBuild('swiftformat'))('swiftformat keeps the source header when it fixes spacing', async () => {
    const { root, environment } = installedSandbox();

    const path = join(root, 'Sources/App/Greeting.swift');
    await using _change = await updateSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'swift/swiftformat',
            files: {
                'Sources/App/Greeting.swift': SOURCE_HEADER + CLEAN_SWIFT.replace('func greeting', 'func   greeting'),
            },
        },
    );

    const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftformat', '--fix'], environment);

    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);

    expect(await readFile(path, 'utf8')).toBe(SOURCE_HEADER + CLEAN_SWIFT);
});

async function readDocumentationFindings(root: string, code: 0 | 1, scope: string) {
    const result = await spawnGspot(root, SWIFT_FORMAT_CHECK);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        ...(scope === '' ? [] : [{ scope: '', status: 'skipped' as const }]),
        { scope, status: code === 0 ? 'passed' : 'failed' },
    ]);
    return report.checks.flatMap(({ findings }) => findings.filter(({ rule }) => rule === 'blockComments'));
}

// SwiftFormat has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))('recommended leaves Swift block comments unchecked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['swift'], { level: 'recommended' }),
        'Value.swift': SWIFT_DOCS_SOURCE,
    });
    const configured = await spawnGspot(sandbox.path, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    expect(await readDocumentationFindings(sandbox.path, 1, '')).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, 'Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
});

// The pinned SwiftFormat tool has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'level all reports and fixes Swift block comments and honors an ignore in gspot.toml',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const settings = buildSettingsText(['swift'], { level: 'all' });
        await createFileTree(root, { 'gspot.toml': settings, 'Value.swift': SWIFT_DOCS_SOURCE });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        const findings = await readDocumentationFindings(root, 1, '');
        expect(findings.map(({ file, line, column }) => [file, line, column])).toStrictEqual([
            ['Value.swift', 1, 1],
            ['Value.swift', 9, 1],
        ]);
        expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
        const corrected = await spawnGspot(root, [...SWIFT_FORMAT_CHECK, '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 0, '')).toStrictEqual([]);
        expect(await Bun.file(join(root, 'Value.swift')).text()).toContain('"/** not documentation */"');
        await Bun.write(join(root, 'Value.swift'), SWIFT_DOCS_SOURCE);
        const ignored = await spawnGspot(root, [
            'ignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--reason',
            'The imported source retains its documentation layout.',
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 1, '')).toStrictEqual([]);
        expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
    },
);

// The pinned SwiftFormat tool has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'SwiftFormat reports inline block comments at their positions and keeps the file mode and swiftformat:disable comments',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'gspot.toml': buildSettingsText(['swift'], { level: 'all' }),
            'Value.swift': SWIFT_INLINE_DOCS,
        });
        const configured = await spawnGspot(root, ['apply']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        await chmod(join(root, 'Value.swift'), 0o444);
        const found = await readDocumentationFindings(root, 1, '');
        const { mode } = await stat(join(root, 'Value.swift'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o444 }));
        await chmod(join(root, 'Value.swift'), 0o644);
        expect(found.map(({ line, column }) => [line, column])).toStrictEqual([
            [4, 1],
            [7, 1],
            [8, 1],
            [11, 1],
        ]);
        expect(await Bun.file(join(root, 'Value.swift')).text()).toBe(SWIFT_INLINE_DOCS);
        const corrected = await spawnGspot(root, [...SWIFT_FORMAT_CHECK, '--fix']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 0, '')).toStrictEqual([]);
        const correctedText = await Bun.file(join(root, 'Value.swift')).text();
        expect(correctedText).toContain('"/** literal */"');
        expect(correctedText).toContain('/// An inline /** example */ remains documentation.');
        expect(correctedText).toContain('/** A retained declaration. */');
    },
);

// The pinned SwiftFormat tool has no Windows build.
test.skipIf(!hasToolBuild('swiftformat'))(
    'an ignore limited to a scope path stops SwiftFormat block-comment findings until unignore',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const settings = buildSettingsText(['swift'], {
            tables: `[[scope]]
path = "nested"

`,
            level: 'all',
        });
        await createFileTree(root, { 'gspot.toml': settings, 'nested/Value.swift': SWIFT_DOCS_SOURCE });
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
            'The imported source retains its documentation layout.',
        ]);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        expect(await readDocumentationFindings(root, 1, 'nested')).toStrictEqual([]);
        const removed = await spawnGspot(root, [
            'unignore',
            'swift/swiftformat',
            '--rule',
            'blockComments',
            '--paths',
            'nested/**',
        ]);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        const findings = await readDocumentationFindings(root, 1, 'nested');
        expect(findings.map(({ file, line, column }) => [file, line, column])).toStrictEqual([
            ['nested/Value.swift', 1, 1],
            ['nested/Value.swift', 9, 1],
        ]);
        expect(await Bun.file(join(root, 'nested/Value.swift')).text()).toBe(SWIFT_DOCS_SOURCE);
    },
);

test.skipIf(!hasToolBuild('swiftlint'))(
    'SwiftLint and SwiftFormat read the configuration of their scope, and the findings keep the scope path',
    async () => {
        const { root, environment } = installedSandbox();
        await using _change = await updateSandbox(
            { root, environment: {}, run: spawnGspot },
            {
                check: 'swift/swiftlint',
                removed: Object.keys(SWIFT_SANDBOX.files),
                files: {
                    'ios/Sources/App/Greeting.swift': CLEAN_SWIFT,
                    'README.md': '# test\n',
                    'ios/Sources/App/Cast.swift': '',
                    'gspot.toml': buildSettingsText([], {
                        level: 'all',
                        tables: `[[scope]]
path = "ios"
configurations = ["swift"]
`,
                    }),
                },
            },
        );
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
            const clean = await spawnGspot(root, ['check', '--only', id], environment);
            expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
        }
        const result = await checkChanges(
            root,
            { check: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST_SWIFT } },
            environment,
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const failed = JSON.parse(result.stdout) as RunReport;
        expect(failed.checks).toMatchObject([{ check: 'swift/swiftlint', scope: 'ios', status: 'failed' }]);
        expect(failed.checks[0]!.findings).toContainEqual(
            matchFields({ file: 'ios/Sources/App/Cast.swift', rule: 'force_cast', line: 5 }),
        );
        await Bun.write(join(root, 'ios/Sources/App/Cast.swift'), CLEAN_SWIFT.replace('greeting', 'correctedGreeting'));
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'swift/swiftlint', scope: 'ios', status: 'passed', findings: [] },
        ]);
    },
);
