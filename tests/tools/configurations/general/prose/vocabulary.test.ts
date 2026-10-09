import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { parseAlerts } from '#cli/parsers/output/contracts.ts';
import { VOCABULARY_INI, VOCABULARY_SOURCE } from '#tests/config/tools/configurations/general/prose/vocabulary.ts';

test.each((['recommended', 'all'] as const).flatMap((level) => ['', 'app'].map((scope) => ({ level, scope }))))(
    '$level native vocabulary accepts selected scoped products and reports a misspelling in "$scope"',
    async ({ level, scope }) => {
        await using directory = await testdir();
        const policy = buildPolicy(scope === '' ? ['prose', 'sql'] : ['prose'], {
            level,
            tables:
                '[words]\nNebulaProduct = "The project product."\n' +
                (scope === '' ? '' : '[scope.app]\nconfigurations = ["sql"]\n'),
        });
        await createFileTree(directory.path, { 'gspot.toml': policy, [join(scope, 'guide.md')]: VOCABULARY_SOURCE });
        const assets = emitAll(await openSession(directory.path)).files.filter(
            ({ path }) => path.endsWith('/vocabularies/words/accept.txt') || path.endsWith('/gspot/possessives.yml'),
        );
        await createFileTree(directory.path, {
            ...Object.fromEntries(assets.map(({ path, content }) => [path, content])),
            '.vale.ini': VOCABULARY_INI,
        });
        const native = await runTestCommand(
            ['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', join(scope, 'guide.md')],
            { cwd: directory.path },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(parseAlerts(native.stdout).map(({ check, line }) => ({ check, line }))).toStrictEqual([
            { check: 'Vale.Spelling', line: 5 },
            { check: 'Vale.Terms', line: 7 },
            { check: 'gspot.possessives', line: 7 },
            { check: 'gspot.possessives', line: 7 },
        ]);
        await Bun.write(
            join(directory.path, scope, 'guide.md'),
            VOCABULARY_SOURCE.replace('sqlfluf.', 'sqlfluff.').replace("Avoid vale's and ajv's.", 'Use Vale and ajv.'),
        );
        const corrected = await runTestCommand(
            ['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', join(scope, 'guide.md')],
            { cwd: directory.path },
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(parseAlerts(corrected.stdout)).toStrictEqual([]);
    },
);
