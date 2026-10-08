import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/harness/git.ts';
import { readPolicy } from '#cli/policy/public.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readTree } from '#tests/harness/preservation.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';

import {
    SCRIPT_SOURCE,
    DETECT_TEMPLATE,
    INITIAL_OVERRIDES,
    AUTHORED_OVERRIDES,
    AUTHORED_SCRIPT_SCOPE,
} from '#tests/config/cli/commands/manual-choices.ts';

test('authored language overrides survive root and scope reconciliation without detection evidence', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_OVERRIDES, 'api/README.md': '# API\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(
        (JSON.parse(preview.stdout) as ApplyPlanJson).policy,
    );
    const policy = readPolicy(sandbox.path).policy;
    expect(policy.configurations).toContain('css');
    expect(policy.configurations).toContain('react');
    expect(policy.scope['api']?.configurations).toContain('python');
    const stable = await readTree(sandbox.path);
    const repeated = await runGspot(sandbox.path, ['apply']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
});

test.each(INITIAL_OVERRIDES)(
    'initialization keeps an explicitly selected $name language after its source disappears',
    async ({ source, files, argv, scope }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, files);
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, ['init', '--yes', ...argv, ...QUIET_INIT]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        await rm(join(sandbox.path, source));
        const applied = await runGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const policy = readPolicy(sandbox.path).policy;
        expect(scope === '' ? policy.configurations : policy.scope[scope]?.configurations).toContain('bash');
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
    const removed = await runGspot(sandbox.path, ['remove', 'bash']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.removed_configurations).toContain('bash');
    for (const hasSource of [true, false, true]) {
        await (hasSource ? writeFile(join(sandbox.path, 'run.sh'), SCRIPT_SOURCE) : rm(join(sandbox.path, 'run.sh')));
        const result = await runGspot(sandbox.path, ['apply']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(readPolicy(sandbox.path).policy.configurations).not.toContain('bash');
    }
});

test('authored language choices remain when source evidence disappears and returns', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const hasSource of [false, true]) {
        await (hasSource ? writeFile(join(sandbox.path, 'run.sh'), SCRIPT_SOURCE) : rm(join(sandbox.path, 'run.sh')));
        const result = await runGspot(sandbox.path, ['apply']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(readPolicy(sandbox.path).policy.configurations).toContain('bash');
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
    await rm(join(sandbox.path, 'run.sh'));
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
    expect(readPolicy(sandbox.path).policy.scope['api']?.configurations).not.toContain('bash');
});

test('a detect template keeps its named language while other configurations follow detection', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'run.sh': SCRIPT_SOURCE, 'team.template.toml': DETECT_TEMPLATE });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', '--from', 'team.template.toml', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    await rm(join(sandbox.path, 'run.sh'));
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.configurations).toContain('bash');
});

test('an authored scope keeps its language choice while absent and after its source disappears', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'api/package.json': '{"private":true}\n',
        'api/run.sh': SCRIPT_SOURCE,
    });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--yes', ...QUIET_INIT]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.scope['api']?.configurations).toContain('bash');
    await rm(join(sandbox.path, 'api'), { recursive: true });
    const absent = await runGspot(sandbox.path, ['apply']);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    await createFileTree(sandbox.path, { 'api/package.json': '{"private":true}\n' });
    const returned = await runGspot(sandbox.path, ['apply']);
    expect(returned.code, returned.stdout + returned.stderr).toBe(0);
    expect(readPolicy(sandbox.path).policy.scope['api']?.configurations).toContain('bash');
});

test('policy application writes no hidden choices and refuses the retired history field', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_SCRIPT_SCOPE });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const statePath = join(sandbox.path, '.gspot/state/ownership.json');
    expect(JSON.parse(await Bun.file(statePath).text())).not.toHaveProperty('selections');
    await Bun.write(statePath, '{"version":1,"files":[],"selections":{}}\n');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('selections');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
