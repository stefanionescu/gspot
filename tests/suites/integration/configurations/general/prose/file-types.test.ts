import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PROSE_SANDBOX } from '#tests/config/integration/prose.ts';
import { spawnRootCheck } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const PROSE_COMMENT_CASES = [
    { name: 'a .mts file', extension: 'mts', marker: '//', code: 'const text = "delve";' },
    { name: 'an extensionless script', extension: '', marker: '#', code: 'text = "delve"' },
] as const;

const CONCRETE_RULE = `extends: existence
message: "Use inspect."
level: error
tokens: [delve]
`;

const PROSE_SAMPLE = {
    check: 'prose/vale',
    files: {
        'docs/selling.md': `# A page

This powerful cache makes the application much faster.
`,
    },
    expected: { file: 'docs/selling.md', rule: 'gspot.marketing', line: 3, column: 6 },
    corrected: {
        files: {
            'docs/selling.md': `# A page

This cache returns stored records.
`,
        },
    },
} as const;

const EXAMPLE_STYLE_FOLDER = `${dirname(GSPOT_PATHS.valeConfig)}/styles/Example`;

const VALE_INI = `StylesPath = styles
MinAlertLevel = suggestion
[*]
BasedOnStyles = Example
`;

test('prose/vale reports a finding in a .sh file and passes after the fix', async () => {
    const sandbox = installedSandbox();
    const path = 'sample.sh';
    await using _change = await changeSandbox(sandbox, {
        files: {
            'gspot.toml': buildSandboxSettings(['prose', 'bash', 'markdown'], { level: 'all' }),
            [GSPOT_PATHS.valeConfig]: VALE_INI,
            [`${EXAMPLE_STYLE_FOLDER}/Concrete.yml`]: CONCRETE_RULE,
            [path]: '# We delve into the records.\n',
        },
    });
    const failed = await spawnRootCheck(sandbox.root, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([matchFields({ file: path, line: 1, rule: 'Example.Concrete' })]);
    await writeFile(join(sandbox.root, path), '# We inspect the records.\n');
    const corrected = await spawnRootCheck(sandbox.root, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test('Vale parses Markdown in ts comments without treating source strings as prose', async () => {
    const sandbox = installedSandbox();
    const path = 'source.ts';
    await using _change = await changeSandbox(sandbox, {
        files: {
            [path]: [
                '// Pass `whitelist` to the command.',
                '// This whitelist holds the records.',
                'const text = "whitelist";',
                '// @param whitelist the command name',
                '// @param value This whitelist holds the records.',
                '',
            ].join('\n'),
        },
    });
    const result = await spawnRootCheck(sandbox.root, 'prose/vale');
    expect(result.status, result.note).toBe('failed');
    expect(result.findings.filter(({ rule }) => rule === 'gspot.conscious-language')).toStrictEqual([
        matchFields({ file: path, line: 2, rule: 'gspot.conscious-language' }),
        matchFields({ file: path, line: 5, rule: 'gspot.conscious-language' }),
    ]);
});

test.each([...PROSE_COMMENT_CASES])(
    'prose/vale keeps the language and the scope path of $name, which it sends on stdin',
    async ({ extension, marker, code }) => {
        const sandbox = installedSandbox();
        const path = extension === '' ? 'source' : `source.${extension}`;
        const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
        const source = `${prefix}${marker} We delve into records.\n${code}\n`;
        await using _change = await changeSandbox(sandbox, {
            files: {
                'gspot.toml': buildSandboxSettings(['prose', 'bash'], { level: 'all' }),
                [GSPOT_PATHS.valeConfig]: `${VALE_INI}[**/british/**]\nExample.Concrete = NO\n`,
                [`${EXAMPLE_STYLE_FOLDER}/Concrete.yml`]: CONCRETE_RULE,
                [path]: source,
                [`british/${path}`]: source,
            },
        });
        const result = await spawnRootCheck(sandbox.root, 'prose/vale');
        expect(result.status, result.note).toBe('failed');
        expect(result.findings).toStrictEqual([
            matchFields({
                file: path,
                line: extension === '' ? 2 : 1,
                column: marker === '//' ? 7 : 6,
                rule: 'Example.Concrete',
            }),
        ]);
        await writeFile(join(sandbox.root, path), `${prefix}${marker} We inspect records.\n${code}\n`);
        const corrected = await spawnRootCheck(sandbox.root, 'prose/vale');
        expect(corrected.status, corrected.note).toBe('passed');
    },
);

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test('prose/vale reports gspot.marketing and passes after the fix', async () => {
    await assertCheckSample(installedSandbox(), PROSE_SAMPLE);
});
