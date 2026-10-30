import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { spawnRootCheck } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { PROSE_SANDBOX } from '#tests/config/integration/prose.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { VALE_INI, EXAMPLE_STYLE_FOLDER } from '#tests/config/integration/checks/general/prose/vale.ts';

import {
    PROSE_CASES,
    CONCRETE_RULE,
    PROSE_COMMENT_CASES,
    MARKDOWN_COMMENT_CASES,
} from '#tests/config/integration/checks/general/prose/file-types.ts';

test('prose/vale reports a finding in a .sh file and passes after the fix', async () => {
    const sandbox = installedSandbox();
    const path = 'sample.sh';
    await using _change = await changeSandbox(sandbox, {
        files: {
            'gspot.toml': buildSandboxSettings(['prose', 'bash', 'markdown'], { level: 'all' }),
            [GSPOT_PATHS.valeConfigFile]: VALE_INI,
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

test.each([...MARKDOWN_COMMENT_CASES])(
    'Vale parses Markdown in %s comments without treating source strings as prose',
    async (extension, marker, code) => {
        const sandbox = installedSandbox();
        const path = `source.${extension}`;
        await using _change = await changeSandbox(sandbox, {
            files: {
                [path]: [
                    `${marker} Pass \`whitelist\` to the command.`,
                    `${marker} This whitelist holds the records.`,
                    code,
                    `${marker} @param whitelist the command name`,
                    `${marker} @param value This whitelist holds the records.`,
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
    },
);

test.each([...PROSE_COMMENT_CASES])(
    'prose/vale keeps the language and the scope path of a .%s file it sends on stdin',
    async (extension, marker, code) => {
        const sandbox = installedSandbox();
        const path = extension === '' ? 'source' : `source.${extension}`;
        const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
        const source = `${prefix}${marker} We delve into records.\n${code}\n`;
        await using _change = await changeSandbox(sandbox, {
            files: {
                'gspot.toml': buildSandboxSettings(['prose', 'bash'], { level: 'all' }),
                [GSPOT_PATHS.valeConfigFile]: `${VALE_INI}[**/british/**]\nExample.Concrete = NO\n`,
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

test.each([...PROSE_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
