import { rejects } from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { requiredRules } from '#cli/checks/typescript/required-rules.ts';
import type { EngineInput } from '#cli/run/types.ts';

test('required ESLint rules inspect later file overrides and accept their correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["javascript"]\n',
        'package.json': '{"private":true,"type":"module"}\n',
        'a.js': 'export const first = 1;\n',
        'z.js': 'export const last = 2;\n',
    });
    symlinkSync(join(import.meta.dir, '../../../../../node_modules'), join(sandbox.path, 'node_modules'), 'dir');
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/required-rules')!;
    const input: EngineInput = {
        session,
        root: sandbox.path,
        scope: '',
        spec,
        view: selected.view,
        files: session.repository.files,
    };
    const generated = emitAll(session).files.find((file) => file.path === '.gspot/eslint.config.mjs')!;
    mkdirSync(join(sandbox.path, '.gspot'));
    const config = join(sandbox.path, generated.path);
    const base = join(sandbox.path, '.gspot/base.mjs');
    writeFileSync(base, generated.content);
    writeFileSync(
        config,
        "import base from './base.mjs';\nexport default [...base, { files: ['z.js'], rules: { eqeqeq: 'off' } }];\n",
    );
    expect(await requiredRules(input)).toEqual([
        {
            check: 'integrity/required-rules',
            file: '.gspot/eslint.config.mjs',
            line: 1,
            rule: 'rule-off',
            message: 'eqeqeq is off for z.js, and the presets require it for every .js file.',
            fixable: false,
        },
    ]);
    writeFileSync(config, generated.content);
    expect(await requiredRules(input)).toEqual([]);
    writeFileSync(config, 'export default { rules: { missing: true } };\n');
    await rejects(requiredRules(input), { message: /eslint --print-config command failed/u });
    session.cancelSignal = AbortSignal.abort();
    await rejects(requiredRules(input), { message: 'The command was canceled.' });
});
