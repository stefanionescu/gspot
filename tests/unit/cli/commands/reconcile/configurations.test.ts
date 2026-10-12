/** Minimal script sources for detection changes. */

import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { SCRIPT_SOURCE } from '#tests/config/init.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/save-settings.ts';

import {
    SAVED_CHOICES,
    SAVED_SCOPE_CHOICE,
    NESTED_SELECTION_FILES,
    REQUIRED_SELECTION_FILES,
    INHERITED_SELECTION_FILES,
} from '#tests/config/configurations.ts';

/** A child keeps its explicit Python choice even though the root selects it. */

test('apply keeps root and scope configurations that detection does not find', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': SAVED_CHOICES, 'api/README.md': '# API\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(
        (JSON.parse(preview.stdout) as DryRunJson).settings,
    );
    const settings = readSettings(sandbox.path).settings;
    expect(settings.configurations).toContain('css');
    expect(settings.configurations).toContain('react');
    expect(settings.scope['api']?.configurations).toContain('python');
    const stable = await readTree(sandbox.path);
    const repeated = await runGspot(sandbox.path, ['apply']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
});

test('a configuration removed by hand stays removed while its files come and go', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, buildInitArguments([]));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const settings = readSettings(sandbox.path).settings;
    expect(settings.configurations).toContain('bash');
    const removed = await runGspot(sandbox.path, ['remove', 'bash']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.removed_configurations).toContain('bash');
    for (const hasSource of [true, false, true]) {
        await (hasSource ? writeFile(join(sandbox.path, 'run.sh'), SCRIPT_SOURCE) : rm(join(sandbox.path, 'run.sh')));
        const result = await runGspot(sandbox.path, ['apply']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(readSettings(sandbox.path).settings.configurations).not.toContain('bash');
    }
});

test('removing a scope configuration before the first apply keeps it removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SAVED_SCOPE_CHOICE,
        'api/run.sh': SCRIPT_SOURCE,
    });
    commitAll(sandbox.path);
    const removed = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.scope['api']?.configurations).not.toContain('bash');
});

test.each(['recommended', 'all'] as const)(
    'apply adds no always-selected or inherited configuration to the saved lists',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...INHERITED_SELECTION_FILES,
            'gspot.toml': settingsText(['typescript', 'python'], {
                level,
                tables: `[[scope]]
path = "app"
configurations = ["python"]
`,
            }),
        });
        commitAll(sandbox.path);
        const before = await readTree(sandbox.path);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        const path = join(sandbox.path, 'gspot.toml');
        expect(await readFile(path, 'utf8')).toBe((preview.json as DryRunJson).settings);
        const session = await openSession(sandbox.path);
        expect(session.settingsFile.settings.configurations).toStrictEqual(['typescript', 'python']);
        expect(session.settingsFile.settings.scope['app']?.configurations).toStrictEqual(['python']);
        const child = session.scopes.find(({ scope }) => scope.path === 'app');
        const selected = child?.selected.map((manifest) => manifest.configuration.name);
        for (const name of ['javascript', 'typescript', 'python', 'engineering', 'files', 'format'])
            expect(selected).toContain(name);
        const stable = await readTree(sandbox.path);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(await readTree(sandbox.path)).toStrictEqual(stable);
        await writeFile(join(sandbox.path, 'run.sh'), 'echo source\n');
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        const detected = await openSession(sandbox.path);
        expect(detected.settingsFile.settings.configurations).toStrictEqual(['typescript', 'python', 'bash']);
        expect(detected.settingsFile.settings.scope['app']?.configurations).toStrictEqual(['python']);
    },
);

test('apply saves a newly detected configuration once, at the outer scope', async () => {
    await using sandbox = await testdir({ ...NESTED_SELECTION_FILES, 'gspot.toml': settingsText([]) });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const session = await openSession(sandbox.path);
    expect(session.settingsFile.settings.configurations).toStrictEqual([]);
    expect(session.settingsFile.settings.scope['app']?.configurations).toStrictEqual(['javascript', 'react']);
    expect(session.settingsFile.settings.scope['app/child']?.configurations).toBeUndefined();
    const child = session.scopes.find(({ scope }) => scope.path === 'app/child');
    const selected = child?.selected.map((manifest) => manifest.configuration.name);
    for (const name of ['javascript', 'react']) expect(selected).toContain(name);
    const stable = await readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
    await createFileTree(sandbox.path, REQUIRED_SELECTION_FILES);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const required = await openSession(sandbox.path);
    expect(required.settingsFile.settings.configurations).toStrictEqual(['typescript']);
    expect(required.settingsFile.settings.scope['app']?.configurations).toStrictEqual(['javascript', 'react']);
    expect(required.settingsFile.settings.scope['app/child']?.configurations).toBeUndefined();
});
