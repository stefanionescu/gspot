import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { LEVELS } from '#cli/config/manifests.ts';
import plugin from '#eslint-plugin/plugin.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings, readEslintRules } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import type { EslintConfiguration } from '#tests/types/setup.ts';

test.each([...LEVELS])('%s runs each gspot rule of its level in JavaScript and TypeScript files', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true,"jsx":"preserve"},"include":["view.tsx"]}\n',
        'source.js': '',
        'view.tsx': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const levels = new Set(level === 'all' ? ['recommended', 'all'] : ['recommended']);
    const expected = Object.fromEntries(
        Object.entries(plugin.rules)
            .filter(([, rule]) => rule.meta.docs?.level !== 'none')
            .map(([name, rule]): [string, number] => [
                `gspot/${name}`,
                levels.has(rule.meta.docs?.level ?? 'none') ? 2 : 0,
            ]),
    );
    const tables = await readEslintRules(eslint, ['source.js', 'view.tsx']);
    for (const [file, table] of Object.entries(tables))
        expect(
            Object.fromEntries(Object.keys(expected).map((name): [string, number] => [name, table[name]?.[0] ?? 0])),
            file,
        ).toStrictEqual(expected);
});

test('level all keeps every rule that level basic turns on for a React file', async () => {
    const rules: Record<string, EslintConfiguration['rules']> = {};
    for (const level of LEVELS) {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['react'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await buildEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('client.jsx')) as EslintConfiguration;
        rules[level] = config.rules;
    }
    const active = Object.entries(rules['basic']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    expect(active.map(([name]) => name)).toContain('@eslint-react/no-missing-key');
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});

test('--fix keeps a suppression for a rule that level basic does not run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'basic' }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const eslint = await buildEslint(sandbox.path, { fix: true });
    const source =
        '// eslint-disable-next-line max-lines-per-function -- reason: The table reads best in one place.\nexport const value = 1;\n';
    const [fixed] = await eslint.lintText(source, { filePath: 'source.js' });
    expect(fixed?.output).toBeUndefined();
    expect(fixed?.messages).toStrictEqual([]);
});

test.each(LEVELS)('level %s reports the unicorn style rules only at level all', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'style.js': ["import { EventEmitter } from 'node:events';", 'export class Bus extends EventEmitter {}'].join(
            '\n',
        ),
    });
    const rules = ['unicorn/prefer-event-target'];
    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(eslint, sandbox.path, ['style.js'], rules);
    expect(findings.map(({ rule, line }) => [line, rule])).toStrictEqual(
        level === 'all' ? rules.map((rule, index) => [index + 2, rule]) : [],
    );
});

test('an unused disable comment is reported at level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js':
            '// eslint-disable-next-line no-console -- reason: The command prints its result.\nexport const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], [])).toStrictEqual([
        { file: 'source.js', rule: null, line: 1 },
    ]);
});
