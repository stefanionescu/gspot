// Takeover at init: the plan names hand-written hooks, refuses unreadable files, carries exception lists with a reason, and lists the lint folder.
import { readPolicy } from '#cli/policy/read.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { treeContents } from '#tests/support/cli/contents.ts';
import { git } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'bash',
    'javascript',
    'spelling',
    'markdown',
    '--no-runner',
    '--no-ci',
    '--no-rules',
    '--no-install',
];

test.each(['', 'hooks', '.husky'])(
    'dry-run distinguishes source hooks from configured hooks at %s',
    async (hooksPath) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
            ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        if (hooksPath !== '') expect(git(sandbox.path, ['config', 'core.hooksPath', hooksPath]).code).toBe(0);
        const result = await run(sandbox.path, [...INIT, '--dry-run']);
        expect(result.code).toBe(0);
        const hooks = result.stdout.split('\n').find((line) => /^hooks\s/.test(line));
        if (hooksPath === '') expect(hooks).toMatch(/^hooks\s+none$/);
        else {
            expect(hooks).toContain(`${hooksPath}/`);
            expect(hooks).toContain('pre-commit');
            expect(hooks?.split('(hand-written)')).toHaveLength(2);
        }
        expect(readFileSync(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    },
    PLANTED_TIMEOUT_MS,
);

test.each([
    ['typos.toml', '[default\n'],
    ['.prettierrc.json', '{"overrides":false}\n'],
    ['.prettierrc.json', '{"plugins":["prettier-plugin-example"],"semi":false}\n'],
    ['.prettierrc.toml', 'semi = "no"\n'],
    ['.prettierrc.json', '{ "semi": false, broken }\n'],
    ['.markdownlint.jsonc', '{ "MD013": false, broken }\n'],
])(
    'unreadable or unsupported %s preserves every original file and mode',
    async (path, text) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [path]: text,
            'notes.md': '# Notes\n',
        });
        const before = treeContents(sandbox.path);
        const preview = await run(sandbox.path, [...INIT, '--no-hooks', '--dry-run']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(preview.stdout).toContain('not read and not deleted');
        expect(treeContents(sandbox.path)).toStrictEqual(before);
        const result = await run(sandbox.path, [...INIT, '--no-hooks']);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout).toContain('Cannot apply takeover');
        expect(treeContents(sandbox.path)).toStrictEqual(before);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'replaces owned files, carries their exception lists with a reason, and lists the lint folder',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': script,
            'src/a.js': 'export const a = 1;\n',
            'README.md': '# planted\n',
            'typos.toml':
                '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\ncertifi = "certifi"\n',
            '.shellcheckrc': 'disable=SC2086,SC2034\n',
            '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
            'quality/lint.sh': script,
        });
        git(sandbox.path, ['init', '-q']);
        git(sandbox.path, ['add', '-A']);
        git(sandbox.path, ['commit', '-qm', 'init']);
        const init = await run(sandbox.path, INIT, { PATH: toolsPath(['ast-grep']) });
        expect(init.code, init.stdout + init.stderr).toBe(0);
        expect(init.stdout).toContain('carried into gspot.toml');
        expect(init.stdout).toContain('quality/');
        const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        expect(policy).toContain('The device identifier API name.');
        expect(policy).toContain('carried from typos.toml at init');
        // The old file named no locale, which accepts every English dialect, so the repository keeps that.
        expect(policy).toContain('locale = "en"');
        expect(readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toContain('locale = "en"');
        expect(policy).toContain('SC2086');
        expect(policy).toContain('carried from .shellcheckrc at init');
        expect(policy).toContain('MD013');
        expect(policy).toContain('MD033 = true');
        const markdown = parseJsonc(readFileSync(join(sandbox.path, '.gspot/config/markdownlint.jsonc'), 'utf8'));
        expect(markdown).toMatchObject({ MD013: false, MD033: true });
        for (const stub of ['typos.toml', '.shellcheckrc', '.markdownlint-cli2.jsonc'])
            expect(readFileSync(join(sandbox.path, stub), 'utf8')).toContain('gspot');
        const eslintStub = ['eslint.config.js', 'eslint.config.mjs'].find((name) =>
            existsSync(join(sandbox.path, name)),
        );
        expect(eslintStub).toBeDefined();
        expect(readFileSync(join(sandbox.path, eslintStub ?? ''), 'utf8')).toContain('gspot');
        expect(existsSync(join(sandbox.path, '.markdownlint.jsonc'))).toBe(false);
        expect(existsSync(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
        const applied = await run(sandbox.path, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(applied.stdout) as { drift: unknown[] }).drift).toStrictEqual([]);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);

test.each(['setup.cfg', 'tox.ini'])(
    'init carries SQLFluff settings without retiring shared %s',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01, RF01\n';
        await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
        chmodSync(join(sandbox.path, path), 0o640);
        const initialized = await run(sandbox.path, [
            'init',
            '--yes',
            '--json',
            '--configurations',
            'sql',
            '--without',
            'naming',
            'spelling',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const policy = readPolicy(sandbox.path).policy;
        expect(
            policy.ignores.filter((entry) => entry.check === 'sql/sqlfluff').map((entry) => entry.rule),
        ).toStrictEqual(['LT01', 'RF01']);
        expect(JSON.parse(initialized.stdout).plan.remove.some((entry: { path: string }) => entry.path === path)).toBe(
            false,
        );
        expect(JSON.parse(initialized.stdout).plan.retained).toContainEqual({
            path,
            note: expect.stringContaining('remove that section manually'),
        });
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, path)).mode & 0o777).toBe(0o640);
        const removed = await run(sandbox.path, ['uninstall', '--yes']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, path)).mode & 0o777).toBe(0o640);
    },
    PLANTED_TIMEOUT_MS,
);
