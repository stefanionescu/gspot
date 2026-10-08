import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { ComputedEslint } from '#tests/types/generation/configuration-files.ts';
import { FRAGMENT_SCOPE_CASES } from '#tests/config/cli/generation/eslint/fragments.ts';

for (const level of ['recommended', 'all'] as const)
    test.each(FRAGMENT_SCOPE_CASES)(`$configuration at ${level} renders each selected scope once`, async (row) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                level,
                tables: `[agent_rules]\nenabled = false\n[scope.first]\nconfigurations = ["${row.configuration}"]\ntest_files = ["unit/**"]\n[scope.first.architecture.roles]\ntest_harness = "support"\n[scope.second]\nconfigurations = ["${row.configuration}"]\ntest_files = ["specs/**"]\n[scope.second.architecture.roles]\ntest_harness = "fixtures"\n`,
            }),
            'package.json': '{"private":true,"type":"module"}',
            'first/package.json': '{"private":true,"type":"module"}',
            'second/package.json': '{"private":true,"type":"module"}',
            'first/tsconfig.json':
                '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
            'second/tsconfig.json':
                '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
            [join('first', row.file)]: row.source,
            [join('second', row.file.replace('unit/', 'specs/'))]: row.source,
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session).files.find(({ path }) => path === '.gspot/config/eslint.config.mjs');
        expect(output!.content.split(`"${row.rule}"`).length - 1).toBe(2);
        const eslint = await createEslint(sandbox.path);
        const first = (await eslint.calculateConfigForFile(join('first', row.file))) as ComputedEslint;
        const second = (await eslint.calculateConfigForFile(
            join('second', row.file.replace('unit/', 'specs/')),
        )) as ComputedEslint;
        expect(first.rules[row.rule]?.[0]).toBe(2);
        expect(second.rules[row.rule]?.[0]).toBe(2);
        if (row.configuration !== 'nestjs') {
            const lint = await eslint.lintFiles([
                join('first', row.file),
                join('second', row.file.replace('unit/', 'specs/')),
            ]);
            expect(lint.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === row.rule)).toHaveLength(
                2,
            );
        }
    });

test('the site configuration requires HTML and suggests optional scripting and styles', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['site']),
        'index.html': '<!doctype html>\n',
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    expect(scope.selected.some(({ configuration }) => configuration.name === 'html')).toBe(true);
    expect(
        scope.selected.some(({ configuration }) => configuration.name === 'javascript' || configuration.name === 'css'),
    ).toBe(false);
});
