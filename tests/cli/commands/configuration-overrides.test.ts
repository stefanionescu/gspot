import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { readPolicy } from '#cli/policy/read.ts';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readTree } from '#tests/harness/preservation.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';

import {
    SCRIPT_SOURCE,
    DETECT_TEMPLATE,
    INITIAL_OVERRIDES,
    AUTHORED_OVERRIDES,
    AUTHORED_SCRIPT_SCOPE,
} from '#tests/config/cli/commands/configuration-overrides.ts';

test('authored language overrides survive root and scope reconciliation without detection evidence', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_OVERRIDES, 'api/README.md': '# API\n' });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(
        (JSON.parse(preview.stdout) as ApplyPreviewJson).policy,
    );
    const policy = readPolicy(sandbox.path).policy;
    expect(policy.configurations).toContain('css');
    expect(policy.configurations).toContain('react');
    expect(policy.scopes.find((scope) => scope.path === 'api')?.configurations).toContain('python');
    const stable = readTree(sandbox.path);
    const repeated = await runGspot(sandbox.path, ['apply']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(readTree(sandbox.path)).toStrictEqual(stable);
});

test.each(INITIAL_OVERRIDES)(
    'initialization keeps an explicitly selected $name language after its source disappears',
    async ({ source, files, argv, scope }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, files);
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, ['init', '--yes', ...argv, ...QUIET_INIT]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        rmSync(join(sandbox.path, source));
        const applied = await runGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const policy = readPolicy(sandbox.path).policy;
        expect(
            scope === '' ? policy.configurations : policy.scopes.find((entry) => entry.path === scope)?.configurations,
        ).toContain('bash');
    },
);

test('a manual removal survives loss and return of detection evidence', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const policy = readPolicy(sandbox.path).policy;
    expect(policy.configurations).toContain('bash');
    const path = join(sandbox.path, 'gspot.toml');
    const authored = await Bun.file(path).text();
    writeFileSync(path, authored.replace('"bash",', ''));
    for (const hasSource of [true, false, true]) {
        if (hasSource) writeFileSync(join(sandbox.path, 'run.sh'), SCRIPT_SOURCE);
        else rmSync(join(sandbox.path, 'run.sh'));
        const result = await runGspot(sandbox.path, ['apply']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(readPolicy(sandbox.path).policy.configurations).not.toContain('bash');
    }
});

test('automatically selected languages disappear with their last source and return when it returns', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const hasSource of [false, true]) {
        if (hasSource) writeFileSync(join(sandbox.path, 'run.sh'), SCRIPT_SOURCE);
        else rmSync(join(sandbox.path, 'run.sh'));
        const result = await runGspot(sandbox.path, ['apply']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(readPolicy(sandbox.path).policy.configurations.includes('bash')).toBe(hasSource);
    }
});

test('adding an already detected language keeps it selected after its source disappears', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const added = await runGspot(sandbox.path, ['add', 'bash']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    rmSync(join(sandbox.path, 'run.sh'));
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.configurations).toContain('bash');
});

test('removing an authored scope language before the first apply keeps the detected language removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': AUTHORED_SCRIPT_SCOPE,
        'api/run.sh': SCRIPT_SOURCE,
    });
    commitAll(sandbox.path);
    const removed = await runGspot(sandbox.path, ['remove', 'bash', '--scope', 'api']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.scopes.find((scope) => scope.path === 'api')?.configurations).not.toContain(
        'bash',
    );
});

test('a detect template keeps its named language while other configurations follow detection', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE, 'team.template.toml': DETECT_TEMPLATE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', '--from', 'team.template.toml', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    rmSync(join(sandbox.path, 'run.sh'));
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.configurations).toContain('bash');
});

test('an automatic scope retains detection history while absent and drops a language missing after its return', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'api/package.json': '{"private":true}\n',
        'api/run.sh': SCRIPT_SOURCE,
    });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.scopes.find((scope) => scope.path === 'api')?.configurations).toContain(
        'bash',
    );
    rmSync(join(sandbox.path, 'api'), { recursive: true });
    const absent = await runGspot(sandbox.path, ['apply']);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    await createFileTree(sandbox.path, { 'api/package.json': '{"private":true}\n' });
    const returned = await runGspot(sandbox.path, ['apply']);
    expect(returned.code, returned.stdout + returned.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.scopes.find((scope) => scope.path === 'api')?.configurations).not.toContain(
        'bash',
    );
});
