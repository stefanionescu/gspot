import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { rulesOff } from '#cli/checks/language/javascript/rules-off.ts';

test('required ESLint rules inspect later file overrides and accept their correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'a.js': 'export const first = 1;\n',
        'z.js': 'export const last = 4;\n',
    });
    linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'javascript/rules-off')!;
    const input: EngineInput = buildEngineInput(session, spec.name);
    const generated = emitAll(session).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    const config = join(sandbox.path, generated.path);
    const base = join(sandbox.path, '.gspot/config/base.mjs');
    writeFileSync(base, generated.content);
    writeFileSync(
        config,
        "import { appendFileSync } from 'node:fs';\nappendFileSync('loads.txt', 'loaded\\n');\nimport base from './base.mjs';\nexport default [...base, { files: ['z.js'], rules: { eqeqeq: 'off' } }];\n",
    );
    const laterOverride = await rulesOff(input);
    expect(laterOverride).toHaveLength(1);
    expect(laterOverride).toMatchObject([
        {
            check: 'javascript/rules-off',
            file: '.gspot/config/eslint.config.mjs',
            line: 1,
            rule: 'rule-off',
            fixable: false,
        },
    ]);
    expect(laterOverride[0]!.message).toContain('eqeqeq');
    expect(laterOverride[0]!.message).toContain('1 file (z.js)');
    expect(laterOverride[0]!.message).toContain('javascript configuration');
    expect(readFileSync(join(sandbox.path, 'loads.txt'), 'utf8')).toBe('loaded\n');
    writeFileSync(config, generated.content);
    expect(await rulesOff(input)).toStrictEqual([]);
    writeFileSync(config, 'export default { rules: { missing: true } };\n');
    await rejects(rulesOff(input), { message: /ESLint rule coverage failed:.*Key "missing": Expected severity/u });
    input.cancelSignal = AbortSignal.abort();
    await rejects(rulesOff(input), { message: 'The command was canceled.' });
});

test('required ESLint rules aggregate all affected files once and name their configuration owner', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'a.js': 'export const first = 1;\n',
        'b.js': 'export const second = 2;\n',
        'c.js': 'export const third = 3;\n',
        'z.js': 'export const last = 4;\n',
    });
    linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const generated = emitAll(session).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(sandbox.path, '.gspot/config/base.mjs'), generated.content);
    writeFileSync(
        join(sandbox.path, generated.path),
        "import base from './base.mjs';\nexport default [...base, { files: ['**/*.js'], rules: { eqeqeq: 'off' } }];\n",
    );
    const findings = await rulesOff(buildEngineInput(session, 'javascript/rules-off'));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
        check: 'javascript/rules-off',
        file: generated.path,
        line: 1,
        rule: 'rule-off',
    });
    expect(findings[0]!.message).toContain('eqeqeq');
    expect(findings[0]!.message).toContain('4 files');
    expect(findings[0]!.message).toContain('a.js, b.js, c.js');
    expect(findings[0]!.message).toContain('1 more');
    expect(findings[0]!.message).toContain('javascript configuration');
});
