import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each([...LEVELS])('%s runs the gspot React, Vue, and library rules that replace SonarJS', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['react'], { level }),
        'package.json':
            '{"private":true,"type":"module","dependencies":{"react":"^19.0.0","vue":"^3.4.0","lodash":"^4.17.21"}}',
        'cart.jsx': '',
        'store.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = [
        'gspot/no-setter-in-component',
        'gspot/no-self-state-update',
        'gspot/no-generated-keys',
        'gspot/no-vue-mixins',
        'gspot/no-default-utility-imports',
    ];
    const files = ['cart.jsx', 'store.js'];
    await createFileTree(sandbox.path, {
        'cart.jsx': [
            'import { useState } from "react";',
            'export function Cart({ rows }) {',
            '    const [count, setCount] = useState(0);',
            '    setCount(count);',
            '    return rows.map((row) => <p key={Math.random()}>{row.name}</p>);',
            '}',
        ].join('\n'),
        'store.js': 'import _ from "lodash";\nexport default { mixins: [_.identity] };\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'cart.jsx', rule: 'gspot/no-self-state-update', line: 4 },
        { file: 'cart.jsx', rule: 'gspot/no-setter-in-component', line: 4 },
        { file: 'cart.jsx', rule: 'gspot/no-generated-keys', line: 5 },
        ...(level === 'all' ? [{ file: 'store.js', rule: 'gspot/no-default-utility-imports', line: 1 }] : []),
        { file: 'store.js', rule: 'gspot/no-vue-mixins', line: 2 },
    ]);
    await createFileTree(sandbox.path, {
        'cart.jsx': [
            'import { useState } from "react";',
            'export function Cart({ rows }) {',
            '    const [count, setCount] = useState(0);',
            '    return rows.map((row) => <p key={row.id} onClick={() => setCount(count + 1)}>{row.name}</p>);',
            '}',
        ].join('\n'),
        'store.js': 'import identity from "lodash/identity";\nexport default { setup: identity };\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test('the Supabase configuration checks the JSON body of each edge function', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase'], { level: 'basic' }),
        'package.json': '{"private":true,"type":"module"}',
        'supabase/config.toml': '',
        'supabase/functions/order/index.js': '',
        'scripts/order.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['supabase/functions/order/index.js', 'scripts/order.js'];
    const edgeFunction =
        'export async function handle(req) {\n    const body = await req.json();\n    return body;\n}\n';
    await createFileTree(sandbox.path, Object.fromEntries(files.map((file) => [file, edgeFunction])));
    expect(await listLintFindings(eslint, sandbox.path, files, ['gspot/no-unvalidated-json-body'])).toStrictEqual([
        { file: 'supabase/functions/order/index.js', rule: 'gspot/no-unvalidated-json-body', line: 2 },
    ]);
    await createFileTree(sandbox.path, {
        'supabase/functions/order/index.js':
            'import { Order } from "./order.js";\nexport async function handle(req) {\n    return Order.parse(await req.json());\n}\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, ['gspot/no-unvalidated-json-body'])).toStrictEqual([]);
});
