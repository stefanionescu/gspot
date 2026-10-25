import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { spawnRootCheck } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PROSE_SANDBOX } from '#tests/config/integration/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';
import { VALE_INI, EXAMPLE_STYLE_FOLDER } from '#tests/config/integration/checks/general/prose/samples.ts';

import {
    PROSE_CASES,
    CONCRETE_RULE,
    FORMATS_VALE_INI,
    PROSE_COMMENT_CASES,
    MARKDOWN_COMMENT_CASES,
} from '#tests/config/integration/checks/general/prose/file-types.ts';

test('prose/vale reports a finding in a .sh file and passes after the fix', async () => {
    await using sandbox = await createGitSandbox({});
    const path = 'sample.sh';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['prose', 'bash', 'markdown']),
        [GSPOT_PATHS.valeConfigFile]: VALE_INI,
        [`${EXAMPLE_STYLE_FOLDER}/Concrete.yml`]: CONCRETE_RULE,
        [path]: '# We delve into the records.\n',
    });
    const failed = await spawnRootCheck(sandbox.path, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([matchFields({ file: path, line: 1, rule: 'Example.Concrete' })]);
    await writeFile(join(sandbox.path, path), '# We inspect the records.\n');
    const corrected = await spawnRootCheck(sandbox.path, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test.each([...MARKDOWN_COMMENT_CASES])(
    'Vale parses Markdown in %s comments without treating source strings as prose',
    async (extension, marker, code) => {
        await using sandbox = await createGitSandbox({});
        const path = `source.${extension}`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['prose']),
            [GSPOT_PATHS.valeConfigFile]: FORMATS_VALE_INI,
            [`${EXAMPLE_STYLE_FOLDER}/Concrete.yml`]: CONCRETE_RULE,
            [path]: [
                `${marker} Pass \`delve\` to the command.`,
                `${marker} We delve into records.`,
                code,
                `${marker} @param delve the command name`,
                `${marker} @param value We delve into records.`,
                '',
            ].join('\n'),
        });
        const result = await spawnRootCheck(sandbox.path, 'prose/vale');
        expect(result.status, result.note).toBe('failed');
        expect(result.findings).toStrictEqual([
            matchFields({ file: path, line: 2, rule: 'Example.Concrete' }),
            matchFields({ file: path, line: 5, rule: 'Example.Concrete' }),
        ]);
    },
);

test.each([...PROSE_COMMENT_CASES])(
    'prose/vale keeps the language and the scope path of a .%s file it sends on stdin',
    async (extension, marker, code) => {
        await using sandbox = await createGitSandbox({});
        const path = extension === '' ? 'source' : `source.${extension}`;
        const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
        const source = `${prefix}${marker} We delve into records.\n${code}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['prose', 'bash']),
            [GSPOT_PATHS.valeConfigFile]: `${VALE_INI}[**/british/**]\nExample.Concrete = NO\n`,
            [`${EXAMPLE_STYLE_FOLDER}/Concrete.yml`]: CONCRETE_RULE,
            [path]: source,
            [`british/${path}`]: source,
        });
        const result = await spawnRootCheck(sandbox.path, 'prose/vale');
        expect(result.status, result.note).toBe('failed');
        expect(result.findings).toStrictEqual([
            matchFields({
                file: path,
                line: extension === '' ? 2 : 1,
                column: marker === '//' ? 7 : 6,
                rule: 'Example.Concrete',
            }),
        ]);
        await writeFile(join(sandbox.path, path), `${prefix}${marker} We inspect records.\n${code}\n`);
        const corrected = await spawnRootCheck(sandbox.path, 'prose/vale');
        expect(corrected.status, corrected.note).toBe('passed');
    },
);

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test.each([...PROSE_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    expect(await runCheckSample(installedSandbox(), sample)).toStrictEqual(buildExpectedSummary(sample));
});
