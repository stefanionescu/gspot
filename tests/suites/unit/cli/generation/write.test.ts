import { join } from 'node:path';
import { testdir } from 'testdirs';
import { unlinkSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import { listStaleLockfiles } from '#cli/installers/projects.ts';
import type { PackageFieldScenario } from '#tests/types/write.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { formatUpToDate, writeGeneratedFiles } from '#cli/generation/write.ts';

import {
    TOOL_FOLDERS,
    EDITED_STYLELINT_PACKAGE,
    STYLELINT_PACKAGE_FIELDS,
    COMMITLINT_PACKAGE_FIELDS,
    EDITED_COMMITLINT_PACKAGE,
} from '#tests/config/generation/write.ts';

async function applyPackageFields(root: string, scenario: PackageFieldScenario): Promise<Map<string, string>> {
    const session = await openSession(root);
    const generated = generateFiles(session);
    expect(generated.managedKeys).toStrictEqual(scenario.changes);
    const writer = openFiles(root);
    await writeGeneratedFiles(session, generated, writer);
    const authored = new Map<string, string>(Object.entries(scenario.project));
    for (const path of scenario.unchanged) expect(await readFile(join(root, path), 'utf8')).toBe(authored.get(path)!);
    return new Map(
        await Promise.all(
            Object.keys(scenario.project).map(
                async (path) => [path, await readFile(join(root, path), 'utf8')] as const,
            ),
        ),
    );
}

test.each([...TOOL_FOLDERS])(
    'writeGeneratedFiles deletes the $kind tool folder when no configuration needs it',
    async ({ folder }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            [`${folder}/tool/index.js`]: 'export {};\n',
        });

        const session = await openSession(sandbox.path);
        const writer = openFiles(sandbox.path);
        await writeGeneratedFiles(session, { files: [], blocks: [], managedKeys: [] }, writer);
        expect(await isOnDisk(join(sandbox.path, folder))).toBe(false);
    },
);

test('leaving level all removes the managed commitlint field from every package.json and keeps the other fields', async () => {
    await using sandbox = await testdir({
        ...COMMITLINT_PACKAGE_FIELDS.project,
        'gspot.toml': buildSandboxSettings(COMMITLINT_PACKAGE_FIELDS.configurations, {
            level: 'all',
            tables: COMMITLINT_PACKAGE_FIELDS.tables,
        }),
    });
    commitAll(sandbox.path);
    const installed = await applyPackageFields(sandbox.path, COMMITLINT_PACKAGE_FIELDS);
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_COMMITLINT_PACKAGE);
    installed.set('app/package.json', EDITED_COMMITLINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'basic' }));
    const session = await openSession(sandbox.path);
    const generated = generateFiles(session);
    expect(generated.managedKeys).toStrictEqual(
        COMMITLINT_PACKAGE_FIELDS.changes.map((file) => ({
            path: file.path,
            keys: [{ key: ['commitlint'], value: undefined }],
        })),
    );
    const writer = openFiles(sandbox.path);
    await writeGeneratedFiles(session, generated, writer);
    for (const [path, source] of installed) {
        const expected = JSON.parse(source) as Record<string, unknown>;
        delete expected['commitlint'];
        const contents: unknown = JSON.parse(await readFile(join(sandbox.path, path), 'utf8'));
        expect(contents).toStrictEqual(expected);
    }
});

test('removing css drops its managed stylelint field and keeps authored fields byte for byte', async () => {
    await using sandbox = await testdir({
        ...STYLELINT_PACKAGE_FIELDS.project,
        'gspot.toml': buildSandboxSettings(STYLELINT_PACKAGE_FIELDS.configurations, {
            level: 'all',
            rules: true,
            tables: STYLELINT_PACKAGE_FIELDS.tables,
        }),
    });
    const installed = await applyPackageFields(sandbox.path, STYLELINT_PACKAGE_FIELDS);
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_STYLELINT_PACKAGE);
    installed.set('app/package.json', EDITED_STYLELINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'all', rules: true }));
    const session = await openSession(sandbox.path);
    const generated = generateFiles(session);
    expect(generated.managedKeys).toStrictEqual([
        { path: 'package.json', keys: [{ key: ['stylelint'], value: undefined }] },
        { path: 'app/child/package.json', keys: [{ key: ['stylelint'], value: undefined }] },
        { path: 'other/package.json', keys: [{ key: ['stylelint'], value: undefined }] },
    ]);
    const writer = openFiles(sandbox.path);
    await writeGeneratedFiles(session, generated, writer);
    for (const [path, source] of installed) {
        if (['package.json', 'app/child/package.json', 'other/package.json'].includes(path)) {
            const expected = JSON.parse(source) as Record<string, unknown>;
            delete expected['stylelint'];
            const contents: unknown = JSON.parse(await readFile(join(sandbox.path, path), 'utf8'));
            expect(contents).toStrictEqual(expected);
        } else expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    }
    const settled = await openSession(sandbox.path);
    const output = generateFiles(settled);
    expect(await listOutdatedFiles(settled, output)).toStrictEqual(await listStaleLockfiles(settled, output.files));
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).not.toContain('`stylelint`');
});

test('a stale generated file removed before planning produces no removal report', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/stale.txt': 'stale\n',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const readKeepingLinks = writer.readKeepingLinks.bind(writer);
    using _disappear = spyOn(writer, 'readKeepingLinks').mockImplementation((path) => {
        if (path === '.gspot/stale.txt') unlinkSync(join(sandbox.path, path));
        return readKeepingLinks(path);
    });
    const report = await writeGeneratedFiles(session, { files: [], blocks: [], managedKeys: [] }, writer);
    expect(report).toStrictEqual({ written: [], unchanged: [], removed: [], updated: [], notes: [] });
    expect(await isOnDisk(join(sandbox.path, '.gspot/stale.txt'))).toBe(false);
});

test('one up-to-date file uses the singular message', () => {
    expect(formatUpToDate(1)).toBe('No change: the 1 generated file is up to date.');
});

test('writing a mise project preserves its lockfile and reports a changed hook', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/mise.lock': 'version = 1\n',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const output = {
        files: [
            { path: '.gspot/mise.toml', content: '[tools]\n' },
            { path: '.gspot/hooks/pre-commit', content: '#!/bin/sh\nexit 0\n', executable: true },
        ],
        blocks: [],
        managedKeys: [],
    };
    const report = await writeGeneratedFiles(session, output, writer);
    expect(await readFile(join(sandbox.path, '.gspot/mise.lock'), 'utf8')).toBe('version = 1\n');
    expect(report.notes).toContain('Git hooks changed. Run gspot install.');
    runGitStep(sandbox.path, ['init', '--quiet']);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.gspot/hooks']);
    output.files[1]!.content = '#!/bin/sh\nexit 1\n';
    const configured = await openSession(sandbox.path);
    const changed = await writeGeneratedFiles(configured, output, writer);
    expect(changed.written).toContain('.gspot/hooks/pre-commit');
    expect(changed.notes).not.toContain('Git hooks changed. Run gspot install.');
});

test('at level basic, prose keeps its Vale configuration and removes installed style packages', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose']),
        'guide.md': '# Guide\n',
        '.gspot/vale/Google/Heading.yml': 'extends: existence\n',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    await writeGeneratedFiles(session, generateFiles(session), writer);
    expect(await isOnDisk(join(sandbox.path, '.gspot/vale'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/general/prose/vale.ini'))).toBe(true);
});

test('apply preserves a copied header example and removes an obsolete scoped link file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { scopes: [{ path: 'docs', configurations: [] }] }),
        'examples/.editorconfig': `${formatHeader('.editorconfig')}root = true\n`,
        'docs/.markdownlint.jsonc': `${formatHeader('.markdownlint.jsonc')}{"extends":"../.markdownlint.jsonc"}\n`,
        'README.md': '# Root\n',
        'docs/README.md': '# Docs\n',
    });
    commitAll(sandbox.path);
    const before = await readFile(join(sandbox.path, 'examples/.editorconfig'));
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const report = await writeGeneratedFiles(session, generateFiles(session), writer);
    expect(await readFile(join(sandbox.path, 'examples/.editorconfig'))).toStrictEqual(before);
    expect(report.removed).toContain('docs/.markdownlint.jsonc');
    expect(await isOnDisk(join(sandbox.path, 'docs/.markdownlint.jsonc'))).toBe(false);
});
