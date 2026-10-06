import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { envExample } from '#cli/checks/general/secrets.ts';

test('environment templates preserve first missing reads per file and escaped custom accessors', async () => {
    await using sandbox = await testdir();
    const source = {
        'config/example.env': 'export KNOWN=example\n# ignored\n',
        'src/first.ts':
            'process.env.KNOWN; process.env.MISSING; process.env["MISSING"];\nconfig.$env("CUSTOM");\nprocess.env.MISSING;\n',
        'src/second.py': 'os.environ["MISSING"]; os.getenv("OTHER");\nos.environ.get("OTHER");\n',
        'src/ignored.txt': 'process.env.TEXT\n',
    };
    await createFileTree(sandbox.path, source);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            level: 'all',
            configurations: ['files'],
            dotenv: { templates: ['example.env'], accessor: 'config.$env' },
        }),
    );
    const input = buildEngineInput(await openSession(sandbox.path), 'secrets/env-example', {
        paths: Object.keys(source),
    });
    expect(envExample(input).map(({ file, line, message: diagnostic }) => ({ file, line, diagnostic }))).toStrictEqual([
        { file: 'src/first.ts', line: 1, diagnostic: 'MISSING is read here and appears in no environment template.' },
        { file: 'src/first.ts', line: 2, diagnostic: 'CUSTOM is read here and appears in no environment template.' },
        { file: 'src/second.py', line: 1, diagnostic: 'MISSING is read here and appears in no environment template.' },
        { file: 'src/second.py', line: 1, diagnostic: 'OTHER is read here and appears in no environment template.' },
    ]);
    await Bun.write(`${sandbox.path}/config/example.env`, 'KNOWN=value\nMISSING=value\nCUSTOM=value\nOTHER=value\n');
    expect(
        envExample(
            buildEngineInput(await openSession(sandbox.path), 'secrets/env-example', { paths: Object.keys(source) }),
        ),
    ).toStrictEqual([]);
});

test('environment reads without a template in their scope remain unchecked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['files'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["files"]\n',
        }),
    );
    const input = buildEngineInput(await openSession(sandbox.path), 'secrets/env-example', {
        scope: 'app',
        paths: ['.env.example', 'app/source.ts'],
    });
    expect(envExample(input)).toStrictEqual([]);
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
    const rejected = envExample(buildEngineInput(await openSession(sandbox.path), 'secrets/env-example'));
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
    expect(envExample(buildEngineInput(await openSession(sandbox.path), 'secrets/env-example'))).toStrictEqual([]);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    for (const [path, text] of Object.entries(sources))
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(text);
});
