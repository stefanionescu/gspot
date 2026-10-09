import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { containing } from '#tests/harness/expectations.ts';
import { TOKEN_IGNORES } from '#cli/config/generation/eta.ts';
import { runBuiltInCheck } from '#cli/execution/contracts.ts';
import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { VALE_INI, CONCRETE_RULE } from '#tests/config/tools/configurations/general/prose/emission.ts';

for (const extension of ['md', 'sh']) {
    test(`native Vale reports its ${extension} finding and passes after the fix`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose', 'bash', 'markdown']),
            '.gspot/config/vale.ini': VALE_INI,
            '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
            [path]: '# We delve into the records.\n',
        });
        const session = await openSession(directory.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const failed = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
        expect(failed.status, failed.note).toBe('failed');
        expect(failed.findings).toStrictEqual([containing({ file: path, line: 1, rule: 'Example.Concrete' })]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
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
        'gspot.toml': buildPolicy(['prose']),
        '.gspot/config/vale.ini': [
            'StylesPath = styles',
            '[formats]',
            ...Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
                grammar.format === undefined ? [] : [`${extension.slice(1)} = ${grammar.format}`],
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
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const result = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
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
])('Vale retains the grammar and scope paths for %s stdin', async (extension, marker, code) => {
    await using directory = await testdir();
    const path = extension === '' ? 'source' : `source.${extension}`;
    const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
    const source = `${prefix}${marker} We delve into records.\n${code}\n`;
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'bash']),
        '.gspot/config/vale.ini': `${VALE_INI}[british/**]\nExample.Concrete = NO\n`,
        '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
        [path]: source,
        [`british/${path}`]: source,
    });
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const result = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
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
    const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(
        await openSession(directory.path),
        planned!,
    );
    expect(corrected.status, corrected.note).toBe('passed');
    expect(await Bun.file(join(directory.path, 'british', path)).text()).toBe(source);
});
