import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { symlinkSync, unlinkSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';

import { readRepository } from '#cli/repository/tree.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { askInitQuestions } from '#cli/commands/init/questions.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';

const tooling: ExistingTooling = {
    configs: [{ tool: 'prettier', path: '.prettierrc.json', carries: 'rules-table' as const }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

test('formatter choices use the captured observation and a fresh failed observation is retained', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.prettierrc.json': '{"semi":false,"tabWidth":8}\n' });
    const carried = await collectCarried(sandbox.path, tooling, new Set(['formatting']), ['source.js']);
    expect(carried.unread).toStrictEqual([]);
    await Bun.write(join(sandbox.path, '.prettierrc.json'), 'invalid JSON');
    const answers = await askInitQuestions(
        sandbox.path,
        {
            cwd: sandbox.path,
            yes: true,
            isDryRun: true,
            json: false,
            install: false,
            allowDirty: false,
            hooks: 'none',
            ci: 'none',
            runner: 'none',
            rules: 'no',
            format: 'keep',
        },
        tooling,
        carried.formatter,
    );
    expect(answers.formatter?.format).toMatchObject({ indent_width: 8, semicolons: false });
    const refreshed = await collectCarried(sandbox.path, tooling, new Set(['formatting']), ['source.js']);
    expect(refreshed.unread.map((entry) => entry.path)).toStrictEqual(['.prettierrc.json']);
    expect(refreshed.removed).toStrictEqual([]);
});

test('takeover refuses a configuration symlink and preserves its outside target', async () => {
    await using repository = await testdir();
    await using outside = await testdir();
    const original = '{"semi":false}\n';
    await createFileTree(outside.path, { 'authored.json': original });
    symlinkSync(join(outside.path, 'authored.json'), join(repository.path, '.prettierrc.json'));
    const carried = await collectCarried(repository.path, tooling, new Set(['formatting']), ['source.js']);
    expect(carried.removed).toStrictEqual([]);
    expect(carried.unread.map(({ path }) => path)).toStrictEqual(['.prettierrc.json']);
    expect(await Bun.file(join(outside.path, 'authored.json')).text()).toBe(original);
});

test('overlapping Markdown sources remain intact before any policy is carried', async () => {
    await using sandbox = await testdir();
    const original = '{"MD033":false}\n';
    await createFileTree(sandbox.path, { '.markdownlint.jsonc': original, 'guide/.markdownlint.jsonc': original });
    const discovered = existingTooling(sandbox.path, (await readRepository(sandbox.path, [], [], [])).files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['markdown']), []);
    expect(carried.unread).toContainEqual(
        expect.objectContaining({ path: '.markdownlint.jsonc', note: expect.stringContaining('Overlapping') }),
    );
    expect(carried.removed).toStrictEqual([]);
    expect(carried.scopes.size).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.markdownlint.jsonc')).text()).toBe(original);
    expect(await Bun.file(join(sandbox.path, 'guide/.markdownlint.jsonc')).text()).toBe(original);
});

test.each(['cycle', 'escape', 'external link', 'unsupported parent'])(
    'Markdown inheritance preserves inputs for %s and accepts a corrected parent',
    async (defect) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        const original = '{"config":{"extends":"./config/base.jsonc","MD033":true}}\n';
        const validParent = '{"default":false,"MD009":true}\n';
        await createFileTree(sandbox.path, {
            '.markdownlint-cli2.jsonc': original,
            'config/base.jsonc':
                defect === 'cycle'
                    ? '{"extends":"./base.jsonc"}\n'
                    : defect === 'escape'
                      ? '{"extends":"../../outside.json"}\n'
                      : '{"customRules":["./custom.mjs"]}\n',
        });
        if (defect === 'external link') {
            await createFileTree(outside.path, { 'base.jsonc': validParent });
            unlinkSync(join(sandbox.path, 'config/base.jsonc'));
            symlinkSync(join(outside.path, 'base.jsonc'), join(sandbox.path, 'config/base.jsonc'));
        }
        const discover = {
            ...tooling,
            configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint-cli2.jsonc', carries: 'rules-table' as const }],
        };
        const refused = await collectCarried(sandbox.path, discover, new Set(['markdown']), []);
        expect(refused.unread.map(({ path }) => path)).toStrictEqual(['.markdownlint-cli2.jsonc']);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.tools.get('markdownlint')?.settings['rules']).toBeUndefined();
        expect(await Bun.file(join(sandbox.path, '.markdownlint-cli2.jsonc')).text()).toBe(original);
        if (defect === 'external link') {
            expect(await Bun.file(join(outside.path, 'base.jsonc')).text()).toBe(validParent);
            unlinkSync(join(sandbox.path, 'config/base.jsonc'));
        }
        await Bun.write(join(sandbox.path, 'config/base.jsonc'), validParent);
        const corrected = await collectCarried(sandbox.path, discover, new Set(['markdown']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.tools.get('markdownlint')?.settings['rules']).toStrictEqual({
            default: false,
            MD009: true,
            MD033: true,
        });
        expect(corrected.observed.get('config/base.jsonc')?.bytes.toString()).toBe(validParent);
    },
);

test.each([
    ['.markdownlint.jsonc', '{"MD013":false,"MD033":true,"MD007":{"indent":4}}'],
    ['.markdownlint-cli2.jsonc', '{"config":{"MD013":false,"MD033":true,"MD007":{"indent":4}}}'],
])('Markdown rule choices and options survive conversion from %s', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: text });
    const carried = await collectCarried(
        sandbox.path,
        { ...tooling, configs: [{ tool: 'markdownlint-cli2', path, carries: 'rules-table' as const }] },
        new Set(['markdown']),
        ['README.md'],
    );
    expect(carried.unread).toStrictEqual([]);
    expect(carried.tools.get('markdownlint')?.settings['rules']).toStrictEqual({
        default: true,
        MD013: false,
        MD033: true,
        MD007: { indent: 4 },
    });
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(text);
});

test.each([
    ['.markdownlint.jsonc', '{"extends":"./other.json","MD033":true}'],
    ['docs/.markdownlint.jsonc', '{"extends":"./other.json","MD033":true}'],
    ['.markdownlint-cli2.jsonc', '{"config":{"MD033":true},"customRules":["./rules.cjs"]}'],
    ['.markdownlint.jsonc', '{"MD007":{"indent":null}}'],
])('unrepresented Markdown configuration in %s remains active', async (path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: text });
    const carried = await collectCarried(
        sandbox.path,
        { ...tooling, configs: [{ tool: 'markdownlint-cli2', path, carries: 'rules-table' as const }] },
        new Set(['markdown']),
        ['README.md'],
    );
    expect(carried.unread.map((entry) => entry.path)).toStrictEqual([path]);
    expect(carried.removed).toStrictEqual([]);
    expect(carried.tools.get('markdownlint')?.settings['rules']).toBeUndefined();
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(text);
});

test.each(['setup.cfg', 'tox.ini'])(
    'SQLFluff adoption carries only its section and preserves shared %s',
    async (path) => {
        await using sandbox = await testdir();
        for (const unrelated of ['', '[flake8]\nignore = E501\n']) {
            const original = `${unrelated}[sqlfluff]\nexclude_rules = LT01, RF01\n`;
            await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
            const repository = await readRepository(sandbox.path, [], [], []);
            const discovered = existingTooling(sandbox.path, repository.files, []);
            const carried = await collectCarried(sandbox.path, discovered, new Set(['sql']), ['query.sql']);
            expect(carried.unread).toStrictEqual([]);
            expect(carried.removed).toStrictEqual([]);
            expect(
                [...carried.tools.values()].flatMap((tool) => tool.ignores).map(({ check, rule }) => ({ check, rule })),
            ).toStrictEqual([
                { check: 'sql/sqlfluff', rule: 'LT01' },
                { check: 'sql/sqlfluff', rule: 'RF01' },
            ]);
            expect(carried.retained).toStrictEqual([
                { path, note: expect.stringContaining('remove that section manually') },
            ]);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        }
        await Bun.write(join(sandbox.path, path), '[flake8]\nignore = E501\n');
        const repository = await readRepository(sandbox.path, [], [], []);
        expect(existingTooling(sandbox.path, repository.files, []).configs).toStrictEqual([]);
    },
);

test('nested SQLFluff exclusions stay inside their configuration directory', async () => {
    await using sandbox = await testdir();
    const path = 'database/.sqlfluff';
    await createFileTree(sandbox.path, { [path]: '[sqlfluff]\n; Repository exception\nexclude_rules = LT01\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const carried = await collectCarried(
        sandbox.path,
        existingTooling(sandbox.path, repository.files, []),
        new Set(['sql']),
        ['database/query.sql', 'other/query.sql'],
    );
    expect(carried.unread).toStrictEqual([]);
    expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toStrictEqual([
        { check: 'sql/sqlfluff', rule: 'LT01', paths: ['database/**'], reason: expect.any(String) },
    ]);
    expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
});

test.each(['.sqlfluff', 'setup.cfg'])(
    'SQLFluff adopts continued exclusions from %s and retains duplicate-key input',
    async (path) => {
        await using sandbox = await testdir();
        const prefix = path === 'setup.cfg' ? '[flake8]\r\nignore = E501\r\n' : '';
        const original = `${prefix}[sqlfluff]\r\nexclude_rules = LT01,\r\n    RF01\r\n`;
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const detected = existingTooling(sandbox.path, repository.files, []);
        const adopted = await collectCarried(sandbox.path, detected, new Set(['sql']), []);
        expect(adopted.unread).toStrictEqual([]);
        expect(adopted.tools.get('sqlfluff')!.ignores.map((entry) => entry.rule)).toStrictEqual(['LT01', 'RF01']);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        const invalid = `${prefix}[sqlfluff]\nexclude_rules = LT01\nexclude_rules = RF01\n`;
        await Bun.write(join(sandbox.path, path), invalid);
        const refused = await collectCarried(sandbox.path, detected, new Set(['sql']), []);
        expect(refused.unread).toMatchObject([{ path, note: expect.stringContaining('Duplicate SQLFluff option') }]);
        expect(refused.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(invalid);
    },
);

test.each([
    '[sqlfluff]\nexclude_rules = LT01\n[sqlfluff:rules]\ncapitalisation_policy = lower\n',
    '[sqlfluff]\nexclude_rules = LT01\n[sqlfluff]\nexclude_rules = RF01\n',
])('unsupported or duplicate shared SQLFluff sections remain unadopted', async (original) => {
    await using sandbox = await testdir();
    const path = 'setup.cfg';
    await createFileTree(sandbox.path, { [path]: original });
    const configs = [
        { tool: 'sqlfluff', check: 'sql/sqlfluff', path, table: 'sqlfluff', shared: true, carries: 'rules-table' },
    ] as const;
    const carried = await collectCarried(sandbox.path, { ...tooling, configs: [...configs] }, new Set(['sql']), []);
    expect(carried.unread.map((entry) => entry.path)).toStrictEqual([path]);
    expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toStrictEqual([]);
    expect(carried.removed).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    await Bun.write(join(sandbox.path, path), '[sqlfluff]\nexclude_rules = LT01\n');
    const corrected = await collectCarried(sandbox.path, { ...tooling, configs: [...configs] }, new Set(['sql']), []);
    expect(corrected.unread).toStrictEqual([]);
    expect([...corrected.tools.values()].flatMap((tool) => tool.ignores).map((entry) => entry.rule)).toStrictEqual([
        'LT01',
    ]);
    expect(corrected.removed).toStrictEqual([]);
});

test.each([
    ['.sqlfluffignore', 'sql', 'sqlfluff', 'exclude'],
    ['.semgrepignore', 'security', 'semgrep', 'ignore'],
] as const)(
    'declared %s adoption keeps nested selectors and refuses negation',
    async (name, configuration, tool, key) => {
        await using sandbox = await testdir();
        const path = `nested/${name}`;
        const original = '# Generated fixtures\nfixtures/\n';
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set([configuration]), []);
        expect(carried.unread).toStrictEqual([]);
        expect(carried.tools.get(tool)?.settings[key]).toStrictEqual([
            { paths: ['nested/**/fixtures/**'], reason: expect.any(String) },
        ]);
        expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
        const unsupported = `${original}!fixtures/checked.sql\n`;
        await Bun.write(join(sandbox.path, path), unsupported);
        const refused = await collectCarried(sandbox.path, discovered, new Set([configuration]), []);
        expect(refused.unread.map((entry) => entry.path)).toStrictEqual([path]);
        expect(refused.tools.get(tool)?.settings[key] ?? []).toStrictEqual([]);
        expect(refused.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(unsupported);
    },
);

test.each([
    ['gitleaks.toml', 'secrets', '[allowlist]\nregexes = ["example-token"]\n'],
    ['osv-scanner.toml', 'dependencies', '[[IgnoredVulns]]\nid = "GO-2022-0968"\n'],
    ['.license-checker.json', 'licenses', '{"onlyAllow":"MIT"}\n'],
] as const)(
    'nested %s cannot silently widen settings to the whole repository',
    async (name, configuration, original) => {
        await using sandbox = await testdir();
        const path = `nested/${name}`;
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set([configuration]), []);
        expect(carried.unread.map((entry) => entry.path)).toStrictEqual([path]);
        expect(carried.tools.size).toBe(0);
        expect(carried.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    },
);

test.each(['typos.toml', 'nested/typos.toml'])(
    'invalid spelling locale in %s refuses adoption before retirement',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[default]\nlocale = "en_US"\n';
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const detected = existingTooling(sandbox.path, repository.files, []);
        const refused = await collectCarried(sandbox.path, detected, new Set(['spelling']), []);
        expect(refused.unread).toMatchObject([{ path }]);
        expect(refused.removed).toStrictEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(refused.scopes.size).toBe(0);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        await Bun.write(join(sandbox.path, path), '[default]\nlocale = "en-ca"\n');
        const corrected = await collectCarried(sandbox.path, detected, new Set(['spelling']), []);
        expect(corrected.unread).toStrictEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toStrictEqual([path]);
    },
);

test('overlapping spelling configurations remain intact without partial adoption', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'typos.toml': '[default.extend-words]\nteh = "teh"\n',
        'nested/typos.toml': '[default]\nlocale = "en-gb"\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const carried = await collectCarried(
        sandbox.path,
        existingTooling(sandbox.path, repository.files, []),
        new Set(['spelling']),
        [],
    );
    expect(carried.unread.map(({ path }) => path)).toStrictEqual(['typos.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.scopes.size).toBe(0);
    expect(carried.removed).toStrictEqual([]);
});

test('disabled-rule adoption carries the declared destination and refuses an undeclared destination', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const detected = existingTooling(sandbox.path, repository.files, []);
    const declared = detected.configs.find((entry) => entry.tool === 'shellcheck')!;
    declared.check = 'shell-policy/lint';
    const adopted = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(adopted.unread).toStrictEqual([]);
    expect(adopted.tools.get('shellcheck')!.ignores).toMatchObject([{ check: declared.check, rule: 'SC2086' }]);
    delete declared.check;
    const refused = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(refused.unread).toMatchObject([{ path: '.shellcheckrc' }]);
    expect(refused.removed).toStrictEqual([]);
    expect(refused.tools.has('shellcheck')).toBe(false);
});

test('ShellCheck adoption separates comments and quotes from every disabled code', async () => {
    await using sandbox = await testdir();
    const original = 'disable="2086" # preserve word splitting\ndisable=SC2002\n';
    await createFileTree(sandbox.path, { '.shellcheckrc': original });
    const repository = await readRepository(sandbox.path, [], [], []);
    const detected = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(carried.unread).toStrictEqual([]);
    expect(carried.tools.get('shellcheck')!.ignores.map((entry) => entry.rule)).toStrictEqual(['SC2086', 'SC2002']);
    expect(await Bun.file(join(sandbox.path, '.shellcheckrc')).text()).toBe(original);
});
