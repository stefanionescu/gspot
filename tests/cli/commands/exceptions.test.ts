// Saved list exceptions survive previews, append, removal, replacement, and inherited settings.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { valueAt } from '#cli/platform/objects.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readTree } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { SettingsListJson } from '#cli/types/commands/list.ts';
import type { PolicyPreviewJson } from '#cli/types/commands/policy-edit.ts';

import {
    HOST_LOCK,
    ROOT_PROJECT,
    EXCEPTION_REASON,
    PRIMITIVE_EXCEPTIONS,
} from '#tests/config/cli/commands/setting-reasons.ts';

test.each(PRIMITIVE_EXCEPTIONS)(
    '$key saves reasons through previews and list mutations',
    async ({ key, value, second }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript', 'site'], { level: 'all', tables: ROOT_PROJECT });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'entry.ts': 'export const entry = 1;\n',
            'app/entry.ts': 'export const entry = 1;\n',
            'sibling/entry.ts': 'export const entry = 1;\n',
        });
        const before = readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, value]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain(`gspot set ${key} needs a reason`);
        expect(readTree(sandbox.path)).toStrictEqual(before);
        const preview = await runGspot(sandbox.path, [
            'set',
            key,
            value,
            '--replace',
            '--reason',
            EXCEPTION_REASON,
            '--dry-run',
            '--json',
        ]);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        const proposed = JSON.parse(preview.stdout) as PolicyPreviewJson;
        expect(proposed.dryRun).toBe(true);
        expect(valueAt(parseToml(proposed.policy), key.split('.'))).toStrictEqual({
            value: [value],
            reason: EXCEPTION_REASON,
        });
        expect(readTree(sandbox.path)).toStrictEqual(before);
        for (const argv of [
            ['set', key, value, '--replace', '--reason', EXCEPTION_REASON],
            ['set', key, second, '--reason', EXCEPTION_REASON],
            ['set', key, value, '--remove'],
        ]) {
            const changed = await runGspot(sandbox.path, argv);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        }
        const text = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
        const raw = parseToml(text);
        const saved = valueAt(raw, key.split('.'));
        expect(saved).toStrictEqual({ value: [second], reason: EXCEPTION_REASON });
        await Bun.write(join(sandbox.path, 'gspot.toml'), text.replace(EXCEPTION_REASON, 'N/A'));
        const invalidTree = readTree(sandbox.path);
        const invalid = await runGspot(sandbox.path, ['apply', '--dry-run']);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(invalid.stderr).toContain(key);
        expect(invalid.stderr).toContain('needs a reason that says something');
        expect(readTree(sandbox.path)).toStrictEqual(invalidTree);
        await Bun.write(join(sandbox.path, 'gspot.toml'), text);
    },
);

test.each(PRIMITIVE_EXCEPTIONS)(
    '$key child replacement preserves root and sibling reasons and restores inheritance',
    async ({ key, value, second, defaults }) => {
        await using sandbox = await testdir();
        const authored = `${key} = { value = ${JSON.stringify([second])}, reason = ${JSON.stringify(EXCEPTION_REASON)} }\n`;
        const policy = buildPolicy(['typescript', 'site'], {
            level: 'all',
            tables: ROOT_PROJECT.replace('[agent_rules]', authored + '[agent_rules]'),
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'entry.ts': 'export const entry = 1;\n',
            'app/entry.ts': 'export const entry = 1;\n',
            'sibling/entry.ts': 'export const entry = 1;\n',
        });
        const listed = await runGspot(sandbox.path, ['list', 'settings', '--json']);
        expect(listed.code, listed.stdout + listed.stderr).toBe(0);
        expect(
            (JSON.parse(listed.stdout) as SettingsListJson).settings
                .filter((row) => row.key === key)
                .map(({ scope, value: effective }) => ({ scope, value: effective })),
        ).toStrictEqual([
            { scope: '', value: [...defaults, second] },
            { scope: 'app', value: [...defaults, second] },
            { scope: 'sibling', value: [...defaults, second] },
        ]);
        const child = await runGspot(sandbox.path, [
            'set',
            key,
            value,
            '--replace',
            '--scope',
            'app',
            '--reason',
            EXCEPTION_REASON,
        ]);
        expect(child.code, child.stdout + child.stderr).toBe(0);
        const childValues = await runGspot(sandbox.path, ['list', 'settings', '--json']);
        expect(childValues.code, childValues.stdout + childValues.stderr).toBe(0);
        expect(
            (JSON.parse(childValues.stdout) as SettingsListJson).settings
                .filter((row) => row.key === key)
                .map(({ scope, value: effective }) => ({ scope, value: effective })),
        ).toStrictEqual([
            { scope: '', value: [...defaults, second] },
            { scope: 'app', value: [...defaults, second, value] },
            { scope: 'sibling', value: [...defaults, second] },
        ]);
        const tightened = await runGspot(sandbox.path, ['set', key, '[]', '--replace', '--scope', 'app']);
        expect(tightened.code, tightened.stdout + tightened.stderr).toBe(0);
        const reset = await runGspot(sandbox.path, ['set', key, '--default', '--scope', 'app']);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const restored = await runGspot(sandbox.path, ['list', 'settings', '--json']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        expect(
            (JSON.parse(restored.stdout) as SettingsListJson).settings.find(
                (row) => row.key === key && row.scope === 'app',
            )?.value,
        ).toStrictEqual([...defaults, second]);
        const saved = parseToml(await Bun.file(join(sandbox.path, 'gspot.toml')).text());
        expect(valueAt(saved, key.split('.'))).toStrictEqual({ value: [second], reason: EXCEPTION_REASON });
    },
);

test('license presence needs a reason only when its declared requirement is weakened', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy([], { level: 'all', tables: ROOT_PROJECT });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'README.md': '# Example\n',
        'app/README.md': '# App\n',
        'sibling/README.md': '# Sibling\n',
    });
    const before = readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['set', 'docs.license', 'false']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('gspot set docs.license needs a reason');
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const changed = await runGspot(sandbox.path, ['set', 'docs.license', 'false', '--reason', EXCEPTION_REASON]);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(parseToml(await Bun.file(join(sandbox.path, 'gspot.toml')).text())['docs']).toMatchObject({
        license: { value: false, reason: EXCEPTION_REASON },
    });
    const relaxed = await runGspot(sandbox.path, ['check', '--only', 'docs/readme-present', '--json']);
    expect(relaxed.code, relaxed.stdout + relaxed.stderr).toBe(0);
    const tightened = await runGspot(sandbox.path, ['set', 'docs.license', 'true']);
    expect(tightened.code, tightened.stdout + tightened.stderr).toBe(0);
    const missing = await runGspot(sandbox.path, ['check', '--only', 'docs/readme-present', '--json']);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect((JSON.parse(missing.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'LICENSE', rule: 'missing-license' },
    ]);
});

test('Git download hosts require a reviewed allowance while HTTPS remains mandatory', async () => {
    await using sandbox = await testdir();
    const insecureDownload = new URL(HOST_LOCK.packages['node_modules/third'].resolved);
    insecureDownload.protocol = 'http:';
    const locked = structuredClone(HOST_LOCK);
    locked.packages['node_modules/third'].resolved = insecureDownload.href;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: 'require_reasons = true\n[agent_rules]\nenabled = false\n' }),
        'package-lock.json': JSON.stringify(locked, null, 2),
    });
    const command = ['check', '--only', 'dependencies/lockfile-hosts', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toHaveLength(3);
    const allowed = await runGspot(sandbox.path, [
        'set',
        'dependencies.registry_hosts',
        'github.com',
        'codeload.github.com',
        '--reason',
        EXCEPTION_REASON,
    ]);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const insecure = await runGspot(sandbox.path, command);
    expect(insecure.code, insecure.stdout + insecure.stderr).toBe(1);
    expect((JSON.parse(insecure.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'package-lock.json',
            rule: 'host',
            message: `${insecureDownload.href} is not HTTPS.`,
        },
    ]);
    await Bun.write(join(sandbox.path, 'package-lock.json'), JSON.stringify(HOST_LOCK));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('registry allowances stay inside their project scope and reset to inherited defaults', async () => {
    await using sandbox = await testdir();
    const lock = JSON.stringify(HOST_LOCK, null, 2);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: ROOT_PROJECT }),
        'package-lock.json': lock,
        'app/package-lock.json': lock,
        'sibling/package-lock.json': lock,
    });
    const allowed = await runGspot(sandbox.path, [
        'set',
        'dependencies.registry_hosts',
        'github.com',
        'codeload.github.com',
        '--scope',
        'app',
        '--reason',
        EXCEPTION_REASON,
    ]);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const command = ['check', '--only', 'dependencies/lockfile-hosts', '--json'];
    const isolated = await runGspot(sandbox.path, command);
    expect(isolated.code, isolated.stdout + isolated.stderr).toBe(1);
    expect(
        (JSON.parse(isolated.stdout) as RunReport).checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            files: findings.map(({ file }) => file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'failed', files: ['package-lock.json', 'package-lock.json', 'package-lock.json'] },
        { scope: 'app', status: 'passed', files: [] },
        {
            scope: 'sibling',
            status: 'failed',
            files: ['sibling/package-lock.json', 'sibling/package-lock.json', 'sibling/package-lock.json'],
        },
    ]);
    const narrowed = await runGspot(sandbox.path, [...command, '--', 'app/package-lock.json']);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    expect((JSON.parse(narrowed.stdout) as RunReport).checks).toMatchObject([
        { scope: 'app', status: 'passed', findings: [] },
    ]);
    const reset = await runGspot(sandbox.path, ['set', 'dependencies.registry_hosts', '--default', '--scope', 'app']);
    expect(reset.code, reset.stdout + reset.stderr).toBe(0);
    const restored = await runGspot(sandbox.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(
        (JSON.parse(restored.stdout) as RunReport).checks.map(({ scope, findings }) => ({
            scope,
            count: findings.length,
        })),
    ).toStrictEqual([
        { scope: '', count: 3 },
        { scope: 'app', count: 3 },
        { scope: 'sibling', count: 3 },
    ]);
});
