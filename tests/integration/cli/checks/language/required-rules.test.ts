import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { EngineInput } from '#cli/types/execution/execution.ts';
import { linkInstalledModules } from '#tests/harness/cli/platforms.ts';
import { requiredRules } from '#cli/checks/language/javascript/rules-off.ts';

test('required ESLint rules inspect later file overrides and accept their correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['javascript'], '', 'all'),
        'package.json': '{"private":true,"type":"module"}\n',
        'a.js': 'export const first = 1;\n',
        'z.js': 'export const last = 2;\n',
    });
    linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'javascript/rules-off')!;
    const input: EngineInput = scopeInput(session, spec);
    const generated = emitted(session).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
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
            check: 'javascript/rules-off',
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
