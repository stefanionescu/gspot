import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readTree } from '#tests/harness/preservation.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { PolicyPlanJson } from '#cli/types/commands/save-policy.ts';

import {
    PREVIEW_POLICY,
    POLICY_PREVIEW_CASES,
    POLICY_PREVIEW_REFUSALS,
    POLICY_PREVIEW_UNCHANGED,
} from '#tests/config/cli/commands/policy-preview.ts';

test.each(POLICY_PREVIEW_CASES)(
    '$name previews without writing and then publishes the same policy',
    async ({ argv, expected, absent }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': PREVIEW_POLICY,
            'scripts/one.sh': 'echo one\n',
            'scripts/two.sh': 'echo two\n',
            'api/source.sh': 'echo api\n',
            'control.txt': 'preserve this source\n',
        });
        const before = await readTree(sandbox.path);
        const preview = await runGspot(sandbox.path, [...argv, '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(preview.stderr).toBe('');
        const report = JSON.parse(preview.stdout) as PolicyPlanJson;
        expect(report.dryRun).toBe(true);
        const proposed = parse(report.policy);
        expect(proposed).toMatchObject(expected);
        for (const key of absent) expect(proposed).not.toHaveProperty(key);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const human = await runGspot(sandbox.path, [...argv, '--dry-run']);
        expect(human.code, human.stdout + human.stderr).toBe(0);
        expect(human.stderr).toBe('');
        expect(human.stdout).toContain(argv[1]);
        expect(human.stdout).toContain('(dry run: gspot.toml not written)');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const published = await runGspot(sandbox.path, [...argv]);
        expect(published.code, published.stdout + published.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(report.policy);
        expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
    },
);

test.each(POLICY_PREVIEW_UNCHANGED)('$name previews and repeats without applying edited output', async ({ argv }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': PREVIEW_POLICY,
        'scripts/one.sh': 'echo one\n',
        'api/source.sh': 'echo api\n',
        'control.txt': 'preserve this source\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(sandbox.path, '.gspot/config/shellcheckrc');
    await chmod(generated, 0o644);
    await Bun.write(generated, `${await Bun.file(generated).text()}# Preserve this authored edit.\n`);
    const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...argv, '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(JSON.parse(preview.stdout) as PolicyPlanJson).toStrictEqual({
        changed: false,
        policy,
        diff: '',
        dryRun: true,
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const repeated = await runGspot(sandbox.path, [...argv, '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(JSON.parse(repeated.stdout) as { changed: boolean }).toStrictEqual({ changed: false });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('a policy preview leaves an active writer claim and existing files untouched', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': PREVIEW_POLICY, 'api/source.sh': 'echo api\n' });
    using log = openOwnership(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['set', 'limits.bash.file_lines', '100', '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(parse((JSON.parse(result.stdout) as PolicyPlanJson).policy)).toMatchObject({
        limits: { bash: { file_lines: 100 } },
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    expect(log.files.read('gspot.toml')?.bytes.toString()).toBe(PREVIEW_POLICY);
});

test.each(POLICY_PREVIEW_REFUSALS)(
    '$name has the same preview and publication refusal without writes',
    async ({ argv }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': PREVIEW_POLICY,
            'api/source.sh': 'echo api\n',
            'control.txt': 'preserve this source\n',
        });
        const before = await readTree(sandbox.path);
        for (const output of [[], ['--json']]) {
            const published = await runGspot(sandbox.path, [...argv, ...output]);
            expect(published.code, published.stdout + published.stderr).toBe(2);
            expect(await readTree(sandbox.path)).toStrictEqual(before);
            const preview = await runGspot(sandbox.path, [...argv, '--dry-run', ...output]);
            expect(preview).toStrictEqual(published);
            expect(await readTree(sandbox.path)).toStrictEqual(before);
        }
    },
);
