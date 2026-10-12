import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { TOKEN_IGNORES, PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { VALE_INI, PROSE_CASES, CONCRETE_RULE, PROSE_SANDBOX } from '#tests/config/prose.ts';

for (const extension of ['sh']) {
    test(`prose/vale reports a finding in a .${extension} file and passes after the fix`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': settingsText(['prose', 'bash', 'markdown']),
            '.gspot/config/vale.ini': VALE_INI,
            '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
            [path]: '# We delve into the records.\n',
        });
        const failedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
        const failed = (JSON.parse(failedCommand.stdout) as RunReport).checks[0]!;
        expect(failed.status, failed.note).toBe('failed');
        expect(failed.findings).toStrictEqual([containing({ file: path, line: 1, rule: 'Example.Concrete' })]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const correctedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
        const corrected = (JSON.parse(correctedCommand.stdout) as RunReport).checks[0]!;
        expect(corrected.status, corrected.note).toBe('passed');
    });
}

test.each([
    ['ts', '//', 'const text = "delve";'],
    ['mts', '//', 'const text = "delve";'],
    ['py', '#', 'text = "delve"'],
])('Vale parses Markdown in %s comments without treating source strings as prose', async (extension, marker, code) => {
    await using directory = await testdir();
    const path = `source.${extension}`;
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose']),
        '.gspot/config/vale.ini': [
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
        '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
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
    const resultCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const result = (JSON.parse(resultCommand.stdout) as RunReport).checks[0]!;
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        containing({ file: path, line: 2, rule: 'Example.Concrete' }),
        containing({ file: path, line: 5, rule: 'Example.Concrete' }),
        containing({ file: path, line: 6, rule: 'Example.Concrete' }),
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
        await using directory = await testdir();
        const path = extension === '' ? 'source' : `source.${extension}`;
        const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
        const source = `${prefix}${marker} We delve into records.\n${code}\n`;
        await createFileTree(directory.path, {
            'gspot.toml': settingsText(['prose', 'bash']),
            '.gspot/config/vale.ini': `${VALE_INI}[**/british/**]\nExample.Concrete = NO\n`,
            '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
            [path]: source,
            [`british/${path}`]: source,
        });
        const resultCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
        const result = (JSON.parse(resultCommand.stdout) as RunReport).checks[0]!;
        expect(result.status, result.note).toBe('failed');
        expect(result.findings).toStrictEqual([
            containing({
                file: path,
                line: extension === '' ? 2 : 1,
                column: marker === '//' ? 7 : 6,
                rule: 'Example.Concrete',
            }),
        ]);
        await Bun.write(join(directory.path, path), `${prefix}${marker} We inspect records.\n${code}\n`);
        const correctedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
        const corrected = (JSON.parse(correctedCommand.stdout) as RunReport).checks[0]!;
        expect(corrected.status, corrected.note).toBe('passed');
        expect(await Bun.file(join(directory.path, 'british', path)).text()).toBe(source);
    },
);

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test.each([...PROSE_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await runCheckSample(installedSandbox(), entry, PROSE_SANDBOX);
});
