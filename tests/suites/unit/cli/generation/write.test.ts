import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { HOOKS_CHANGED_NOTE } from '#cli/config/generation/files.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { formatHeader } from '#cli/generation/builders/header.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listInstallNotes } from '#cli/generation/report.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import { EDITED_STYLELINT_PACKAGE } from '#tests/config/generation/generate.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/setup/configurations.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

test('removing css drops its managed stylelint field and keeps authored fields byte for byte', async () => {
    const project = {
        'package.json': STYLELINT_PACKAGE_JSON,
        'source.css': 'a { opacity: 1; }\n',
        'app/package.json': STYLELINT_PACKAGE_JSON,
        'app/source.css': 'a { opacity: 1; }\n',
        'app/child/package.json': STYLELINT_PACKAGE_JSON,
        'app/child/source.css': 'a { opacity: 1; }\n',
        'other/package.json': STYLELINT_PACKAGE_JSON,
        'other/source.css': 'a { opacity: 1; }\n',
        'plain/package.json': '{"private":true}\n',
    };
    const scopes = [{ path: 'app' }, { path: 'app/child' }, { path: 'other' }];
    await using sandbox = await createGitSandbox({
        ...project,
        'gspot.toml': buildSandboxSettings(['css'], { level: 'all', rules: true, scopes }),
    });
    const selected = await openSession(sandbox.path);
    const fields = buildGeneratedFiles(selected);
    expect(fields.managedKeys).toStrictEqual([
        { path: 'package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }] },
        {
            path: 'app/child/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../../.gspot/configurations/css/stylelint.json' } }],
        },
        {
            path: 'app/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/css/stylelint.json' } }],
        },
        {
            path: 'other/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/css/stylelint.json' } }],
        },
    ]);
    await writeGeneratedFiles(selected, fields, openFiles(sandbox.path));
    expect(await readFile(join(sandbox.path, 'plain/package.json'), 'utf8')).toBe(project['plain/package.json']);
    const installed = new Map<string, string>();
    for (const path of Object.keys(project)) installed.set(path, await readFile(join(sandbox.path, path), 'utf8'));
    await writeFile(join(sandbox.path, 'app/package.json'), EDITED_STYLELINT_PACKAGE);
    installed.set('app/package.json', EDITED_STYLELINT_PACKAGE);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([], { level: 'all', rules: true }));
    const session = await openSession(sandbox.path);
    const generated = buildGeneratedFiles(session);
    expect(generated.managedKeys).toStrictEqual([
        { path: 'package.json', keys: [{ key: ['stylelint'], value: undefined }] },
        { path: 'app/child/package.json', keys: [{ key: ['stylelint'], value: undefined }] },
        { path: 'other/package.json', keys: [{ key: ['stylelint'], value: undefined }] },
    ]);
    await writeGeneratedFiles(session, generated, openFiles(sandbox.path));
    for (const [path, source] of installed) {
        const written = await readFile(join(sandbox.path, path), 'utf8');
        if (['package.json', 'app/child/package.json', 'other/package.json'].includes(path)) {
            const { stylelint: _stylelint, ...expected } = JSON.parse(source) as Record<string, unknown>;
            expect(JSON.parse(written) as unknown).toStrictEqual(expected);
        } else expect(written).toBe(source);
    }
    const settled = await openSession(sandbox.path);
    const output = buildGeneratedFiles(settled);
    expect(listStaleFiles(settled, output)).toStrictEqual(listStaleLockfiles(settled, output.files));
});

test('writing a mise project preserves its lockfile and asks for an install after a changed hook', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = true\n' }),
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
    expect(await listInstallNotes(session, output, report)).toContain(HOOKS_CHANGED_NOTE);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', '.gspot/hooks']);
    output.files[1]!.content = '#!/bin/sh\nexit 1\n';
    const configured = await openSession(sandbox.path);
    const changed = await writeGeneratedFiles(configured, output, writer);
    expect(changed.written).toContain('.gspot/hooks/pre-commit');
    expect(await listInstallNotes(configured, output, changed)).not.toContain(HOOKS_CHANGED_NOTE);
});

test('at level basic, gspot removes the Vale configuration and the installed style packages', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['prose']),
        'guide.md': '# Guide\n',
        '.gspot/vale/Google/Heading.yml': 'extends: existence\n',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    await writeGeneratedFiles(session, buildGeneratedFiles(session), writer);
    expect(existsSync(join(sandbox.path, '.gspot/vale'))).toBe(false);
});

test('writing the generated files preserves a copied header example and removes an obsolete scoped pointer file', async () => {
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
    const report = await writeGeneratedFiles(session, buildGeneratedFiles(session), writer);
    expect(await readFile(join(sandbox.path, 'examples/.editorconfig'))).toStrictEqual(before);
    expect(report.deleted).toContain('docs/.markdownlint.jsonc');
    expect(existsSync(join(sandbox.path, 'docs/.markdownlint.jsonc'))).toBe(false);
});

test('turning hooks off removes .gspot/hooks and unsets core.hooksPath at once', async () => {
    const settings = buildSandboxSettings([], { tables: HOOKS_SETTINGS });
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    await applyGeneratedFiles(sandbox.path);
    runGitStep(sandbox.path, ['config', 'core.hooksPath', GSPOT_PATHS.hooks]);
    await writeFile(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    await applyGeneratedFiles(sandbox.path);
    expect(existsSync(join(sandbox.path, GSPOT_PATHS.hooks, 'pre-commit'))).toBe(false);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
});

test('switching the level and back writes the same files', async () => {
    await using sandbox = await createGitSandbox({});
    await writeFile(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: Array<Array<{ path: string; content: string }>> = [];
    for (const level of ['basic', 'all', 'basic'] as const) {
        const settings = buildSandboxSettings(['javascript'], { rules: true, level });
        await writeFile(join(sandbox.path, 'gspot.toml'), settings);
        const session = await openSession(sandbox.path);
        const output = buildGeneratedFiles(session);
        const writer = openFiles(sandbox.path);
        await writeGeneratedFiles(session, output, writer);
        outputs.push(output.files.map(({ path, content }) => ({ path, content })));
    }
    expect(outputs[1]).not.toStrictEqual(outputs[0]);
    expect(outputs[2]).toStrictEqual(outputs[0]);
});
