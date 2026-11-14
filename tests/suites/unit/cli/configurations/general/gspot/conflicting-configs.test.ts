import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getBuiltInCheck, runSandboxCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

test('gspot/conflicting-configs reports the settings file of a tool only at a level where gspot runs the tool', async () => {
    const files = { '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n' };
    await using basic = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'basic' }),
    });
    expect(await runSandboxCheck(basic.path, 'gspot/conflicting-configs')).toStrictEqual([]);
    await using all = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(all.path, 'gspot/conflicting-configs');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: '.commitlintrc.json', rule: 'conflicting-config' },
    ]);
});

test('gspot/conflicting-configs reports a settings file at a project root, and no source file that shares its name', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'knip.json': '{}\n',
        'main.js': 'export const value = 1;\n',
        'src/tools/knip.js': 'export const knip = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
    expect(findings.map(({ file }) => file)).toStrictEqual(['knip.json']);
});

test('a conflicting config file that .gitattributes marks linguist-generated is not reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }),
        '.gitattributes': '.commitlintrc.json linguist-generated\n',
        '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs')).toStrictEqual([]);
    await writeFile(join(sandbox.path, '.gitattributes'), '');
    const conflicts = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
    expect(
        conflicts.map(({ file, rule }) => ({
            file,
            rule,
        })),
    ).toStrictEqual([{ file: '.commitlintrc.json', rule: 'conflicting-config' }]);
});

test('gspot/conflicting-configs reports a tool section that no generated file edits, and leaves a pointer key', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'css']),
        'pyproject.toml': '[project]\nname = "app"\n\n[tool.ruff]\nline-length = 100\n',
        'package.json': '{"private":true,"stylelint":{"extends":".gspot/stylelint.json"}}\n',
        'app.py': 'VALUE = 1\n',
        'a.css': 'a { color: red; }\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'pyproject.toml', line: 4, rule: 'conflicting-config' },
    ]);
});

test('gspot/conflicting-configs reports a lint command until it goes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{\n  "private": true,\n  "scripts": { "lint": "eslint ." }\n}\n',
        'main.js': 'export const value = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'package.json',
            line: 3,
            rule: 'lint-command',
            message: expect.stringContaining('calls eslint: `eslint .`. Replace') as string,
        },
    ]);
    await writeFile(
        join(sandbox.path, 'package.json'),
        '{\n  "private": true,\n  "scripts": { "lint": "gspot check" }\n}\n',
    );
    expect(await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs')).toStrictEqual([]);
});

test('conflicting-configs on selected paths reports only those paths', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{\n  "private": true,\n  "scripts": { "lint": "eslint ." }\n}\n',
        'knip.json': '{}\n',
        'main.js': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const check = getBuiltInCheck('gspot/conflicting-configs', { content: 'index', paths: ['package.json'] });
    const findings = await check(session, planSandboxCheck(session, 'gspot/conflicting-configs'));
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'package.json', rule: 'lint-command' },
    ]);
});
