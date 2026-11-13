import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    ['ESLint', '[[tools.eslint.plugins]]\nname = "local"'],
    ['Stylelint', '[[tools.stylelint.plugins]]'],
])('import rules exempt a local %s plugin named by settings', async (_tool, record) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'css'], {
            tables: `[[import_rule]]\nname = "source"\npaths = ["src/**"]\n${record}\npath = "tools/lint/plugin.mjs"\nrules = {}\n`,
        }),
        'src/index.js': 'export {};\n',
        'tools/lint/plugin.mjs': '',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/import-rules')).toStrictEqual([]);
});

test('a node shebang script needs no import rule', async () => {
    const tables = '[[import_rule]]\nname = "source"\npaths = ["src/**"]\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables }),
        'tools/run.js': '#!/usr/bin/env node\nexport {};\n',
        'lib/x.js': 'export {};\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/import-rules')).toMatchObject([
        { file: 'lib/x.js', rule: 'uncovered-file' },
    ]);
});
