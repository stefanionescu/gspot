import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import { rejection } from '#tests/harness/expectations.ts';
import * as policyFile from '#cli/policy/document/public.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/document/public.ts';

import {
    POLICY_LAYOUT_CASES,
    POLICY_LAYOUT_EXTERNAL_EDIT,
    POLICY_LAYOUT_UNREPRESENTABLE,
} from '#tests/config/cli/execution/fixers/policy-layout.ts';

test.each(POLICY_LAYOUT_CASES)(
    'the policy-layout command corrects $name without installation',
    async ({ source, expected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': source, 'notes.txt': 'Authored source.\n' });
        const path = join(sandbox.path, 'gspot.toml');
        await chmod(path, 0o640);
        using files = openRoot(sandbox.path);
        const { mode } = files.read('gspot.toml')!;
        const before = await readTree(sandbox.path);
        const command = ['check', '--only', 'gspot/policy-layout'];
        const checked = await runGspot(sandbox.path, command);
        expect(checked.code, checked.stderr + checked.stdout).toBe(1);
        expect(checked.stdout).toContain('canonical layout');
        const preview = await runGspot(sandbox.path, [...command, '--fix', '--dry-run']);
        expect(preview.code, preview.stderr + preview.stdout).toBe(1);
        expect(preview.stdout).toContain('a/gspot.toml');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const corrected = await runGspot(sandbox.path, [...command, '--fix']);
        expect(corrected.code, corrected.stderr + corrected.stdout).toBe(0);
        const written = files.read('gspot.toml')!;
        expect(written.bytes.toString('utf8')).toBe(expected);
        expect(written.mode).toBe(mode);
        expect(files.read('notes.txt')!.bytes.toString('utf8')).toBe('Authored source.\n');
        expect(await pathExists(join(sandbox.path, '.gspot/config'))).toBe(false);
        expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const unchanged = await runGspot(sandbox.path, [...command, '--fix']);
        expect(unchanged.code, unchanged.stderr + unchanged.stdout).toBe(0);
        expect(files.read('gspot.toml')!.bytes.toString('utf8')).toBe(expected);
        expect(emitPolicy(expected, parseTomlText(expected, 'gspot.toml', 'policy'))).toBe(expected);
    },
);

test('a native policy-layout correction preserves an external replacement before publication', async () => {
    await using sandbox = await testdir();
    const source = POLICY_LAYOUT_CASES[0]!.source;
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const path = join(sandbox.path, 'gspot.toml');
    const session = await openSession(sandbox.path);
    const encodePolicy = policyFile.emitPolicy;
    using emission = spyOn(policyFile, 'emitPolicy').mockImplementation((text, policy) => {
        const canonical = encodePolicy(text, policy);

        // eslint-disable-next-line n/no-sync -- reason: The external replacement must occur inside the synchronous emitter before its result can be published.
        if (text === source) writeFileSync(path, POLICY_LAYOUT_EXTERNAL_EDIT);
        return canonical;
    });
    using files = openRoot(sandbox.path);
    const { mode } = files.read('gspot.toml')!;
    const options = buildRunOptions({ only: ['gspot/policy-layout'], fix: true });
    expect(await rejection(executeRun(session, options))).toContain('changed while gspot was running');
    expect(emission).toHaveBeenCalledTimes(1);
    const replacement = files.read('gspot.toml')!;
    expect(replacement.bytes.toString('utf8')).toBe(POLICY_LAYOUT_EXTERNAL_EDIT);
    expect(replacement.mode).toBe(mode);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('canceling a native policy-layout correction keeps authored bytes', async () => {
    await using sandbox = await testdir();
    const source = POLICY_LAYOUT_CASES[0]!.source;
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const session = await openSession(sandbox.path);
    const controller = new AbortController();
    controller.abort();
    const result = await executeRun(session, {
        ...buildRunOptions({ only: ['gspot/policy-layout'], fix: true }),
        cancelSignal: controller.signal,
    });
    expect(result.fixes?.results).toContainEqual({
        check: 'gspot/policy-layout',
        status: 'failed',
        changed: [],
        note: 'The fix was canceled.',
    });
    using files = openRoot(sandbox.path);
    expect(files.read('gspot.toml')!.bytes.toString('utf8')).toBe(source);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('the policy-layout command refuses an unrepresentable field comment before any policy write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': POLICY_LAYOUT_UNREPRESENTABLE });
    using files = openRoot(sandbox.path);
    const { mode } = files.read('gspot.toml')!;
    const result = await runGspot(sandbox.path, ['check', '--only', 'gspot/policy-layout', '--fix']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('tools.prettier.verbatim.mixed.0.first cannot be represented in TOML 1.0');
    const unchanged = files.read('gspot.toml')!;
    expect(unchanged.bytes.toString('utf8')).toBe(POLICY_LAYOUT_UNREPRESENTABLE);
    expect(unchanged.mode).toBe(mode);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});
