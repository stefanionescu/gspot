import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
