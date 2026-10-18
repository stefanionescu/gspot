import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnRootCheck } from '#tests/setup/run-gspot.ts';
import { shareProseSandbox } from '#tests/setup/sandbox.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { TOKEN_IGNORES, PROSE_GRAMMARS } from '#cli/config/generation/vale.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';
import { VALE_INI, PROSE_CASES, CONCRETE_RULE, PROSE_SANDBOX } from '#tests/data/checks/prose.ts';

test('prose/vale reports a finding in a .sh file and passes after the fix', async () => {
    await using folder = await testdir();
    const path = 'sample.sh';
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['prose', 'bash', 'markdown']),
        '.gspot/configurations/general/prose/vale.ini': VALE_INI,
        '.gspot/configurations/general/prose/styles/Example/Concrete.yml': CONCRETE_RULE,
        [path]: '# We delve into the records.\n',
    });
    const failed = await spawnRootCheck(folder.path, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([matchFields({ file: path, line: 1, rule: 'Example.Concrete' })]);
    await Bun.write(join(folder.path, path), '# We inspect the records.\n');
    const corrected = await spawnRootCheck(folder.path, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test.each([
    ['ts', '//', 'const text = "delve";'],
    ['mts', '//', 'const text = "delve";'],
    ['py', '#', 'text = "delve"'],
])('Vale parses Markdown in %s comments without treating source strings as prose', async (extension, marker, code) => {
    await using folder = await testdir();
    const path = `source.${extension}`;
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['prose']),
        '.gspot/configurations/general/prose/vale.ini': [
            'StylesPath = styles',
            '[formats]',
            ...Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
                'format' in grammar ? [`${extension.slice(1)} = ${grammar.format}`] : [],
            ),
            '[*]',
            'BasedOnStyles = Example',
            `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
            '',
        ].join('\n'),
        '.gspot/configurations/general/prose/styles/Example/Concrete.yml': CONCRETE_RULE,
        [path]: [
            `${marker} Pass \`delve\` to the command.`,
            `${marker} We delve into records.`,
            code,
            `${marker} @param delve the command name`,
            `${marker} @param value We delve into records.`,
            `${marker} eslint-disable no-console -- reason: We delve into records.`,
            '',
        ].join('\n'),
    });
    const result = await spawnRootCheck(folder.path, 'prose/vale');
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        matchFields({ file: path, line: 2, rule: 'Example.Concrete' }),
        matchFields({ file: path, line: 5, rule: 'Example.Concrete' }),
        matchFields({ file: path, line: 6, rule: 'Example.Concrete' }),
    ]);
});

test.each([
    ['mts', '//', 'const text = "delve";'],
    ['cts', '//', 'const text = "delve";'],
    ['mjs', '//', 'const text = "delve";'],
    ['cjs', '//', 'const text = "delve";'],
    ['', '#', 'text = "delve"'],
])(
    'prose/vale keeps the language and the scope path of a .%s file it sends on stdin',
    async (extension, marker, code) => {
        await using folder = await testdir();
        const path = extension === '' ? 'source' : `source.${extension}`;
        const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
        const source = `${prefix}${marker} We delve into records.\n${code}\n`;
        await createFileTree(folder.path, {
            'gspot.toml': buildSettingsText(['prose', 'bash']),
            '.gspot/configurations/general/prose/vale.ini': `${VALE_INI}[**/british/**]\nExample.Concrete = NO\n`,
            '.gspot/configurations/general/prose/styles/Example/Concrete.yml': CONCRETE_RULE,
            [path]: source,
            [`british/${path}`]: source,
        });
        const result = await spawnRootCheck(folder.path, 'prose/vale');
        expect(result.status, result.note).toBe('failed');
        expect(result.findings).toStrictEqual([
            matchFields({
                file: path,
                line: extension === '' ? 2 : 1,
                column: marker === '//' ? 7 : 6,
                rule: 'Example.Concrete',
            }),
        ]);
        await Bun.write(join(folder.path, path), `${prefix}${marker} We inspect records.\n${code}\n`);
        const corrected = await spawnRootCheck(folder.path, 'prose/vale');
        expect(corrected.status, corrected.note).toBe('passed');
        expect(await Bun.file(join(folder.path, 'british', path)).text()).toBe(source);
    },
);

const installedSandbox = shareProseSandbox();

test.each([...PROSE_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, PROSE_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
