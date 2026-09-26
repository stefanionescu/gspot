import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { requiredRules } from '#cli/checks/typescript/required-rules.ts';
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';

test('required ESLint rules inspect later file overrides and accept their correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["javascript"]\n',
        'package.json': '{"private":true,"type":"module"}\n',
        'a.js': 'export const first = 1;\n',
        'z.js': 'export const last = 2;\n',
    });
    symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(sandbox.path, 'node_modules'), 'dir');
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/required-rules')!;
    const input: EngineInput = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
    const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    const config = join(sandbox.path, generated.path);
    const base = join(sandbox.path, '.gspot/config/base.mjs');
    writeFileSync(base, generated.content);
    writeFileSync(
        config,
        "import { appendFileSync } from 'node:fs';\nappendFileSync('loads.txt', 'loaded\\n');\nimport base from './base.mjs';\nexport default [...base, { files: ['z.js'], rules: { eqeqeq: 'off' } }];\n",
    );
    expect(await requiredRules(input)).toStrictEqual([
        {
            check: 'integrity/required-rules',
            file: '.gspot/config/eslint.config.mjs',
            line: 1,
            rule: 'rule-off',
            message: 'eqeqeq is off for z.js, and the configurations require it for every .js file.',
            fixable: false,
        },
    ]);
    expect(readFileSync(join(sandbox.path, 'loads.txt'), 'utf8')).toBe('loaded\n');
    writeFileSync(config, generated.content);
    expect(await requiredRules(input)).toStrictEqual([]);
    writeFileSync(config, 'export default { rules: { missing: true } };\n');
    await rejects(requiredRules(input), { message: /Tool configuration evaluation failed/u });
    input.cancelSignal = AbortSignal.abort();
    await rejects(requiredRules(input), { message: 'The command was canceled.' });
});
