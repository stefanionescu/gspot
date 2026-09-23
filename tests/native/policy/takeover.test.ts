import { readRepository } from '#cli/repository/tree.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { join } from 'node:path';
import { symlinkSync, unlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import type { ExistingTooling } from '#cli/repository/types.ts';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { askInitQuestions } from '#cli/lifecycle/questions.ts';
import { proposeText } from '#cli/policy/propose.ts';
import { openSession } from '#cli/run/session.ts';
import { emitAll } from '#cli/emit/targets.ts';

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
    expect(carried.unread).toEqual([]);
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
    expect(refreshed.unread.map((entry) => entry.path)).toEqual(['.prettierrc.json']);
    expect(refreshed.removed).toEqual([]);
});

test('takeover refuses a configuration symlink and preserves its outside target', async () => {
    await using repository = await testdir();
    await using outside = await testdir();
    const original = '{"semi":false}\n';
    await createFileTree(outside.path, { 'authored.json': original });
    symlinkSync(join(outside.path, 'authored.json'), join(repository.path, '.prettierrc.json'));
    const carried = await collectCarried(repository.path, tooling, new Set(['formatting']), ['source.js']);
    expect(carried.removed).toEqual([]);
    expect(carried.unread.map(({ path }) => path)).toEqual(['.prettierrc.json']);
    expect(await Bun.file(join(outside.path, 'authored.json')).text()).toBe(original);
});

test('directory-local Markdown adoption preserves sibling rules and descendant editor configurations', async () => {
    await using sandbox = await testdir();
    const original = '{"default":false,"MD033":true}\n';
    await createFileTree(sandbox.path, {
        'guide/.markdownlint.jsonc': original,
        'reference/.markdownlint.jsonc': '{"default":false,"MD041":true}\n',
        'guide/sample.md': '<span>Content</span>\n',
        'guide/deep/sample.md': '<span>Content</span>\n',
        'reference/sample.md': '<span>Content</span>\n',
    });
    const discovered = existingTooling(sandbox.path, (await readRepository(sandbox.path, [], [], [])).files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set(['markdown']), []);
    expect(carried.unread).toEqual([]);
    expect(carried.removed.map(({ path }) => path).sort()).toEqual([
        'guide/.markdownlint.jsonc',
        'reference/.markdownlint.jsonc',
    ]);
    expect(carried.tools.has('markdownlint')).toBe(false);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        proposeText({
            presets: ['markdown'],
            scopes: [{ path: 'guide/deep', presets: ['markdown'] }],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const session = await openSession(sandbox.path);
    const configurations = emitAll(session).files.filter(
        (file) => file.kind === 'config' || file.path.endsWith('.markdownlint-cli2.jsonc'),
    );
    for (const file of configurations) await Bun.write(join(sandbox.path, file.path), file.content);
    for (const { path } of carried.removed) unlinkSync(join(sandbox.path, path));
    for (const [scope, rule] of [
        ['guide', 'MD033'],
        ['guide/deep', 'MD033'],
        ['reference', 'MD041'],
    ]) {
        const native = () =>
            Bun.spawnSync(['markdownlint-cli2', '--no-globs', 'sample.md'], {
                cwd: join(sandbox.path, scope!),
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const failed = native();
        expect(failed.exitCode, failed.stderr.toString()).toBe(1);
        expect(failed.stderr.toString()).toContain(rule!);
        expect(failed.stderr.toString()).not.toContain(rule === 'MD033' ? 'MD041' : 'MD033');
        await Bun.write(join(sandbox.path, scope!, 'sample.md'), '# Content\n');
        const corrected = native();
        expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
    }
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
    expect(carried.removed).toEqual([]);
    expect(carried.scopes.size).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.markdownlint.jsonc')).text()).toBe(original);
    expect(await Bun.file(join(sandbox.path, 'guide/.markdownlint.jsonc')).text()).toBe(original);
});

test.each([false, true])(
    'Markdown adoption preserves native rules and corrections with inheritance=%s',
    async (inherited) => {
        await using sandbox = await testdir();
        const original = inherited
            ? '{"extends":"./config/parent.yaml","MD013":false,"MD033":true,"MD009":true}\n'
            : '{"default":false,"MD033":true,"MD009":true}\n';
        await createFileTree(sandbox.path, {
            '.markdownlint.jsonc': original,
            'config/parent.yaml': 'extends: ./base.jsonc\nMD013: {line_length: 3}\nMD033: false\n',
            'config/base.jsonc': '{// Base rules\n"default":false,"MD033":true,"MD009":false}\n',
            'sample.md': 'A paragraph.\n\n<span>Content</span>\n',
        });
        const native = (config: string) =>
            Bun.spawnSync(['markdownlint-cli2', '--no-globs', '--config', config, 'sample.md'], {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const before = native('.markdownlint.jsonc');
        expect(before.exitCode).toBe(1);
        expect(before.stderr.toString()).toContain('MD033');
        const carried = await collectCarried(
            sandbox.path,
            {
                ...tooling,
                configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint.jsonc', carries: 'rules-table' }],
            },
            new Set(['markdown']),
            ['sample.md'],
        );
        expect(carried.unread).toEqual([]);
        if (inherited) {
            expect(carried.removed.map(({ path }) => path)).toEqual(['.markdownlint.jsonc']);
            expect(carried.retained.map(({ path }) => path).toSorted()).toEqual([
                'config/base.jsonc',
                'config/parent.yaml',
            ]);
            expect(carried.observed.get('config/base.jsonc')?.bytes.toString()).toContain('"default":false');
            expect(carried.observed.get('config/parent.yaml')?.bytes.toString()).toContain('line_length: 3');
        }
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            proposeText({
                presets: ['markdown'],
                scopes: [],
                carried,
                hooks: 'none',
                ci: 'none',
                rules: false,
                runner: 'none',
            }),
        );
        const configuration = emitAll(await openSession(sandbox.path)).files.find(
            ({ path }) => path === '.gspot/markdownlint.jsonc',
        )!;
        await Bun.write(join(sandbox.path, 'generated.jsonc'), configuration.content);
        // Remove discovery input so the generated file alone determines the native result.
        unlinkSync(join(sandbox.path, '.markdownlint.jsonc'));
        const after = native('generated.jsonc');
        expect(after.exitCode).toBe(1);
        expect(after.stderr.toString()).toBe(before.stderr.toString());
        await Bun.write(join(sandbox.path, 'sample.md'), 'A paragraph.\n\nContent\n');
        const corrected = native('generated.jsonc');
        expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
        await Bun.write(join(sandbox.path, 'sample.md'), 'A paragraph.   \n');
        const fixed = Bun.spawnSync(
            ['markdownlint-cli2', '--fix', '--no-globs', '--config', 'generated.jsonc', 'sample.md'],
            {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
            },
        );
        expect(fixed.exitCode, fixed.stderr.toString()).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'sample.md')).text()).toBe('A paragraph.\n');
    },
);

test.each([{}, { default: true }])('Markdown adoption preserves native enabled defaults %j', async (defaults) => {
    await using sandbox = await testdir();
    const original = JSON.stringify({ ...defaults, MD009: false });
    await createFileTree(sandbox.path, {
        '.markdownlint.jsonc': original,
        'sample.md': `# Title\n\n<span>${'Long paragraph '.repeat(12)}</span>\n`,
    });
    const native = (config: string) =>
        Bun.spawnSync(['markdownlint-cli2', '--no-globs', '--config', config, 'sample.md'], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const before = native('.markdownlint.jsonc');
    expect(before.exitCode).toBe(1);
    expect(before.stderr.toString()).toContain('MD013');
    expect(before.stderr.toString()).toContain('MD033');
    const carried = await collectCarried(
        sandbox.path,
        {
            ...tooling,
            configs: [{ tool: 'markdownlint-cli2', path: '.markdownlint.jsonc', carries: 'rules-table' }],
        },
        new Set(['markdown']),
        ['sample.md'],
    );
    expect(carried.unread).toEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        proposeText({
            presets: ['markdown'],
            scopes: [],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        }),
    );
    const generated = emitAll(await openSession(sandbox.path)).files.find(
        ({ path }) => path === '.gspot/markdownlint.jsonc',
    )!;
    await Bun.write(join(sandbox.path, 'generated.jsonc'), generated.content);
    unlinkSync(join(sandbox.path, '.markdownlint.jsonc'));
    const after = native('generated.jsonc');
    expect(after.exitCode).toBe(1);
    expect(after.stderr.toString()).toBe(before.stderr.toString());
    await Bun.write(join(sandbox.path, 'sample.md'), '# Title\n\nContent\n');
    const corrected = native('generated.jsonc');
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
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
        expect(refused.unread.map(({ path }) => path)).toEqual(['.markdownlint-cli2.jsonc']);
        expect(refused.removed).toEqual([]);
        expect(refused.tools.get('markdownlint')?.settings['rules']).toBeUndefined();
        expect(await Bun.file(join(sandbox.path, '.markdownlint-cli2.jsonc')).text()).toBe(original);
        if (defect === 'external link') {
            expect(await Bun.file(join(outside.path, 'base.jsonc')).text()).toBe(validParent);
            unlinkSync(join(sandbox.path, 'config/base.jsonc'));
        }
        await Bun.write(join(sandbox.path, 'config/base.jsonc'), validParent);
        const corrected = await collectCarried(sandbox.path, discover, new Set(['markdown']), []);
        expect(corrected.unread).toEqual([]);
        expect(corrected.tools.get('markdownlint')?.settings['rules']).toEqual({
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
    expect(carried.unread).toEqual([]);
    expect(carried.tools.get('markdownlint')?.settings['rules']).toEqual({
        default: true,
        MD013: false,
        MD033: true,
        MD007: { indent: 4 },
    });
    expect(carried.removed.map((entry) => entry.path)).toEqual([path]);
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
    expect(carried.unread.map((entry) => entry.path)).toEqual([path]);
    expect(carried.removed).toEqual([]);
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
            expect(carried.unread).toEqual([]);
            expect(carried.removed).toEqual([]);
            expect(
                [...carried.tools.values()].flatMap((tool) => tool.ignores).map(({ check, rule }) => ({ check, rule })),
            ).toEqual([
                { check: 'sql/sqlfluff', rule: 'LT01' },
                { check: 'sql/sqlfluff', rule: 'RF01' },
            ]);
            expect(carried.retained).toEqual([{ path, note: expect.stringContaining('remove that section manually') }]);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        }
        await Bun.write(join(sandbox.path, path), '[flake8]\nignore = E501\n');
        const repository = await readRepository(sandbox.path, [], [], []);
        expect(existingTooling(sandbox.path, repository.files, []).configs).toEqual([]);
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
    expect(carried.unread).toEqual([]);
    expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toEqual([
        { check: 'sql/sqlfluff', rule: 'LT01', paths: ['database/**'], reason: expect.any(String) },
    ]);
    expect(carried.removed.map((entry) => entry.path)).toEqual([path]);
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
        expect(adopted.unread).toEqual([]);
        expect(adopted.tools.get('sqlfluff')!.ignores.map((entry) => entry.rule)).toEqual(['LT01', 'RF01']);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        const invalid = `${prefix}[sqlfluff]\nexclude_rules = LT01\nexclude_rules = RF01\n`;
        await Bun.write(join(sandbox.path, path), invalid);
        const refused = await collectCarried(sandbox.path, detected, new Set(['sql']), []);
        expect(refused.unread).toMatchObject([{ path, note: expect.stringContaining('Duplicate SQLFluff option') }]);
        expect(refused.removed).toEqual([]);
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
    expect(carried.unread.map((entry) => entry.path)).toEqual([path]);
    expect([...carried.tools.values()].flatMap((tool) => tool.ignores)).toEqual([]);
    expect(carried.removed).toEqual([]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    await Bun.write(join(sandbox.path, path), '[sqlfluff]\nexclude_rules = LT01\n');
    const corrected = await collectCarried(sandbox.path, { ...tooling, configs: [...configs] }, new Set(['sql']), []);
    expect(corrected.unread).toEqual([]);
    expect([...corrected.tools.values()].flatMap((tool) => tool.ignores).map((entry) => entry.rule)).toEqual(['LT01']);
    expect(corrected.removed).toEqual([]);
});

test.each([
    ['.sqlfluffignore', 'sql', 'sqlfluff', 'exclude'],
    ['.semgrepignore', 'security', 'semgrep', 'ignore'],
] as const)('declared %s adoption keeps nested selectors and refuses negation', async (name, preset, tool, key) => {
    await using sandbox = await testdir();
    const path = `nested/${name}`;
    const original = '# Generated fixtures\nfixtures/\n';
    await createFileTree(sandbox.path, { [path]: original });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set([preset]), []);
    expect(carried.unread).toEqual([]);
    expect(carried.tools.get(tool)?.settings[key]).toEqual([
        { paths: ['nested/**/fixtures/**'], reason: expect.any(String) },
    ]);
    expect(carried.removed.map((entry) => entry.path)).toEqual([path]);
    const unsupported = `${original}!fixtures/checked.sql\n`;
    await Bun.write(join(sandbox.path, path), unsupported);
    const refused = await collectCarried(sandbox.path, discovered, new Set([preset]), []);
    expect(refused.unread.map((entry) => entry.path)).toEqual([path]);
    expect(refused.tools.get(tool)?.settings[key] ?? []).toEqual([]);
    expect(refused.removed).toEqual([]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(unsupported);
});

test.each([
    ['gitleaks.toml', 'secrets', '[allowlist]\nregexes = ["example-token"]\n'],
    ['osv-scanner.toml', 'dependencies', '[[IgnoredVulns]]\nid = "GO-2022-0968"\n'],
    ['.license-checker.json', 'licenses', '{"onlyAllow":"MIT"}\n'],
] as const)('nested %s cannot silently widen settings to the whole repository', async (name, preset, original) => {
    await using sandbox = await testdir();
    const path = `nested/${name}`;
    await createFileTree(sandbox.path, { [path]: original });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, discovered, new Set([preset]), []);
    expect(carried.unread.map((entry) => entry.path)).toEqual([path]);
    expect(carried.tools.size).toBe(0);
    expect(carried.removed).toEqual([]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
});

test.each([false, true])(
    'nested spelling adoption writes a local policy table with an existing scope of %s',
    async (existing) => {
        await using sandbox = await testdir();
        const original =
            '[default]\nlocale = "en-gb"\n[default.extend-words]\n# An imported name requires its exact spelling.\nteh = "teh"\n[files]\nextend-exclude = ["src/**", "*.skip", "!keep.skip"]\n';
        await createFileTree(sandbox.path, {
            'nested/typos.toml': original,
            'nested/sample.txt': 'colour teh\n',
            'nested/src/ignored.txt': 'recieve\n',
            'nested/ignored.skip': 'recieve\n',
            'nested/keep.skip': 'recieve\n',
            'sample.txt': 'colour teh\n',
        });
        const native = (path: string) =>
            Bun.spawnSync(['typos', '--force-exclude', path], {
                cwd: join(sandbox.path, 'nested'),
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const expected = [
            ['src/ignored.txt', 0],
            ['ignored.skip', 0],
            ['keep.skip', 2],
        ] as const;
        for (const [path, status] of expected) expect(native(path).exitCode).toBe(status);
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set(['spelling']), []);
        expect(carried.unread).toEqual([]);
        expect(carried.tools.has('typos')).toBe(false);
        expect(carried.removed.map(({ path }) => path)).toEqual(['nested/typos.toml']);
        const policy = proposeText({
            presets: ['spelling'],
            scopes: existing ? [{ path: 'nested', presets: ['markdown'] }] : [],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        });
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        expect(session.policyFiles.policy.scopes).toEqual([
            { path: 'nested', presets: existing ? ['markdown', 'spelling'] : ['spelling'] },
        ]);
        const outputs = emitAll(session).files.filter(
            ({ path }) => path.startsWith('.gspot/') && path.endsWith('typos.toml'),
        );
        for (const config of outputs) await Bun.write(join(sandbox.path, config.path), config.content);
        const run = (config: string, path: string) =>
            Bun.spawnSync(
                [
                    'typos',
                    '--isolated',
                    '--config',
                    config,
                    '--force-exclude',
                    '--format',
                    'brief',
                    '--color',
                    'never',
                    path,
                ],
                { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
            );
        const child = run('.gspot/nested/typos.toml', 'nested/sample.txt');
        expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
        expect(run('.gspot/nested/typos.toml', 'nested/src/ignored.txt').exitCode).toBe(0);
        expect(run('.gspot/nested/typos.toml', 'nested/ignored.skip').exitCode).toBe(0);
        expect(run('.gspot/nested/typos.toml', 'nested/keep.skip').exitCode).toBe(2);
        const root = run('.gspot/typos.toml', 'sample.txt');
        expect(root.exitCode, root.stdout.toString() + root.stderr.toString()).toBe(2);
        expect(root.stdout.toString()).toContain('teh');
        await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
        expect(run('.gspot/typos.toml', 'sample.txt').exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'nested/typos.toml')).text()).toBe(original);
        const editor = emitAll(session).files.find(({ path }) => path === 'nested/typos.toml')!;
        await Bun.write(join(sandbox.path, editor.path), editor.content);
        for (const [path, status] of expected) {
            const checked = native(path);
            expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(status);
        }
        await Bun.write(join(sandbox.path, 'nested/keep.skip'), 'receive\n');
        expect(native('keep.skip').exitCode).toBe(0);
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
        expect(refused.removed).toEqual([]);
        expect(refused.tools.size).toBe(0);
        expect(refused.scopes.size).toBe(0);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
        await Bun.write(join(sandbox.path, path), '[default]\nlocale = "en-ca"\n');
        const corrected = await collectCarried(sandbox.path, detected, new Set(['spelling']), []);
        expect(corrected.unread).toEqual([]);
        expect(corrected.removed.map((entry) => entry.path)).toEqual([path]);
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
    expect(carried.unread.map(({ path }) => path)).toEqual(['typos.toml']);
    expect(carried.tools.size).toBe(0);
    expect(carried.scopes.size).toBe(0);
    expect(carried.removed).toEqual([]);
});

test('disabled-rule adoption carries the declared destination and refuses an undeclared destination', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n' });
    const repository = await readRepository(sandbox.path, [], [], []);
    const detected = existingTooling(sandbox.path, repository.files, []);
    const declared = detected.configs.find((entry) => entry.tool === 'shellcheck')!;
    declared.check = 'shell-policy/lint';
    const adopted = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(adopted.unread).toEqual([]);
    expect(adopted.tools.get('shellcheck')!.ignores).toMatchObject([{ check: declared.check, rule: 'SC2086' }]);
    delete declared.check;
    const refused = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(refused.unread).toMatchObject([{ path: '.shellcheckrc' }]);
    expect(refused.removed).toEqual([]);
    expect(refused.tools.has('shellcheck')).toBe(false);
});

test('ShellCheck adoption separates comments and quotes from every disabled code', async () => {
    await using sandbox = await testdir();
    const original = 'disable="2086" # preserve word splitting\ndisable=SC2002\n';
    await createFileTree(sandbox.path, { '.shellcheckrc': original });
    const repository = await readRepository(sandbox.path, [], [], []);
    const detected = existingTooling(sandbox.path, repository.files, []);
    const carried = await collectCarried(sandbox.path, detected, new Set(['bash']), []);
    expect(carried.unread).toEqual([]);
    expect(carried.tools.get('shellcheck')!.ignores.map((entry) => entry.rule)).toEqual(['SC2086', 'SC2002']);
    expect(await Bun.file(join(sandbox.path, '.shellcheckrc')).text()).toBe(original);
});
