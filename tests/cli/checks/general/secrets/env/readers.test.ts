import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { textContaining } from '#tests/harness/expectations.ts';

import {
    READER_FILES,
    READER_TABLES,
    READER_FINDINGS,
    READER_TEMPLATE,
    PROJECT_READER_FILES,
    PROJECT_READER_TABLES,
    PROJECT_READER_CORRECTIONS,
} from '#tests/config/cli/checks/general/secrets/env/readers.ts';

test('checks Bun and multiple declared readers without an enabling flag', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy([], { tables: READER_TABLES });
    await createFileTree(sandbox.path, { ...READER_FILES, 'gspot.toml': policy });
    const command = ['check', '--only', 'secrets/env-template', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        { check: 'secrets/env-template', status: 'failed', findings: READER_FINDINGS },
    ]);
    await Bun.write(join(sandbox.path, 'config/example.env'), READER_TEMPLATE);
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'secrets/env-template', status: 'passed', findings: [] },
    ]);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});

test('checks each scope against its own templates and declared readers', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...PROJECT_READER_FILES,
        'gspot.toml': buildPolicy([], { tables: PROJECT_READER_TABLES }),
    });
    const command = ['check', '--only', 'secrets/env-template', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        { scope: '', status: 'failed', findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }] },
        { scope: 'app', status: 'failed', findings: [{ file: 'app/source.ts', line: 1, rule: 'missing-key' }] },
        {
            scope: 'sibling',
            status: 'failed',
            findings: [{ file: 'sibling/source.ts', line: 1, rule: 'missing-key' }],
        },
    ]);
    await createFileTree(sandbox.path, PROJECT_READER_CORRECTIONS);
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.map((check) => check.status)).toEqual([
        'passed',
        'passed',
        'passed',
    ]);
});

test('keeps Bun reads active with no custom reader declarations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        '.env.example': 'KNOWN=example\n',
        'source.ts': 'Bun.env.KNOWN; Bun.env["MISSING"];\nconfig.$env("UNDECLARED");\n',
    });
    const checked = await runGspot(sandbox.path, ['check', '--only', 'secrets/env-template', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'secrets/env-template',
            status: 'failed',
            findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }],
        },
    ]);
});

test('environment reads without a template in their scope report the unmet prerequisite', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['files'], {
            level: 'all',
            tables: '[scope."app"]\nconfigurations = ["files"]\n',
        }),
    );
    const input = buildCheckInput(await openSession(sandbox.path), 'secrets/env-template', {
        scope: 'app',
        paths: ['.env.example', 'app/source.ts'],
    });
    expect(() => BUILT_IN_CHECKS['secrets/env-template'].input(input)).toThrow('secrets.env_examples');
    const checked = await runGspot(sandbox.path, [
        'check',
        'app/source.ts',
        '--only',
        'secrets/env-template',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'secrets/env-template',
            scope: 'app',
            status: 'skipped',
            findings: [],
            note: textContaining('secrets.env_examples'),
        },
    ]);
});

test('modern environment accessors in component and module files require matching template keys', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['files'], { level: 'all' });
    const sources = {
        'app.astro': '---\nconst endpoint = import.meta.env.VITE_API;\n---\n<main>{endpoint}</main>\n',
        'app.svelte': '<script>const endpoint = import.meta.env["SVELTE_API"];</script>\n<main>{endpoint}</main>\n',
        'app.vue':
            '<script setup>const endpoint = import.meta.env.VUE_API;</script>\n<template>{{ endpoint }}</template>\n',
        'worker.ts': 'const endpoint = Deno.env.get("DENO_API");\nDeno.env.get("DENO_API");\n',
        'module.mts': 'export const endpoint = import.meta.env.MODULE_API;\n',
        'common.cts': 'export const endpoint = process.env.COMMON_API;\n',
        'legacy.cjs': 'exports.endpoint = process.env.LEGACY_API;\n',
        'notes.txt': 'import.meta.env.UNREAD_API; Deno.env.get("UNREAD_API");\n',
    };
    await createFileTree(sandbox.path, { 'gspot.toml': policy, '.env.example': 'KNOWN=example\n', ...sources });
    const rejected = BUILT_IN_CHECKS['secrets/env-template'].input(
        buildCheckInput(await openSession(sandbox.path), 'secrets/env-template'),
    );
    expect(rejected.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'app.astro', line: 2, rule: 'missing-key' },
        { file: 'app.svelte', line: 1, rule: 'missing-key' },
        { file: 'app.vue', line: 1, rule: 'missing-key' },
        { file: 'common.cts', line: 1, rule: 'missing-key' },
        { file: 'legacy.cjs', line: 1, rule: 'missing-key' },
        { file: 'module.mts', line: 1, rule: 'missing-key' },
        { file: 'worker.ts', line: 1, rule: 'missing-key' },
    ]);
    await Bun.write(
        join(sandbox.path, '.env.example'),
        'KNOWN=example\nVITE_API=example\nSVELTE_API=example\nVUE_API=example\nDENO_API=example\nMODULE_API=example\nCOMMON_API=example\nLEGACY_API=example\n',
    );
    expect(
        BUILT_IN_CHECKS['secrets/env-template'].input(
            buildCheckInput(await openSession(sandbox.path), 'secrets/env-template'),
        ),
    ).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    for (const [path, text] of Object.entries(sources))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
});
