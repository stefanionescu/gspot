// Replace at init: the plan names hand-written hooks, the files of the selected tools, and the lint folder, and keeps
// a shared file that holds other tools' sections.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/read.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { git, commitAll } from '#tests/harness/git.ts';
import { prepare } from '#cli/commands/init/prepare.ts';
import { writeSetup } from '#cli/commands/init/write.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { PLAN_INIT } from '#tests/config/cli/commands/init/replace.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { buildInitOptions, buildInitArguments } from '#tests/harness/init.ts';

import {
    rmSync,
    statSync,
    chmodSync,
    existsSync,
    symlinkSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';

test.each(['', 'hooks', '.husky'])(
    'dry-run distinguishes source hooks from configured hooks at %s',
    async (hooksPath) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
            ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });
        expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
        const configured = hooksPath === '' ? { code: 0 } : git(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        expect(configured.code).toBe(0);
        const result = await runGspot(sandbox.path, [...PLAN_INIT, '--dry-run']);
        expect(result.code).toBe(0);
        const hooks = result.stdout.split('\n').find((line) => /^hooks\s/.test(line)) ?? '';
        // No configured hooks reads "none"; a configured folder is named with its one hand-written hook.
        expect(hooks).toMatch(
            hooksPath === '' ? /^hooks\s+none$/ : new RegExp(String.raw`^hooks\s.*${hooksPath}/.*pre-commit`),
        );
        expect(hooks.split('(hand-written)')).toHaveLength(hooksPath === '' ? 1 : 2);
        expect(readFileSync(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    },
);

test('the init plan replaces the files of the selected tools and lists the lint folder', async () => {
    await using sandbox = await testdir();
    const originals = {
        'typos.toml': '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\n',
        '.shellcheckrc': 'disable=SC2086,SC2034\n',
        '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
        '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
        '.prettierrc': '{ "semi": false }\n',
    };
    await createFileTree(sandbox.path, {
        ...originals,
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'src/a.js': 'export const a = 1;\n',
        'README.md': '# test\n',
        'quality/lint.sh': CLEAN_BASH_SCRIPT,
    });
    git(sandbox.path, ['init', '-q']);
    git(sandbox.path, ['add', '-A']);
    git(sandbox.path, ['commit', '-qm', 'init']);
    const preview = await runGspot(sandbox.path, [...PLAN_INIT, '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan!;
    for (const path of Object.keys(originals))
        expect(plan.remove).toContainEqual({ path, note: textContaining('replaced by the generated') });
    expect(plan.noLongerRuns).toContainEqual({ path: 'quality/', note: textContaining('lint scripts') });
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test.each(['setup.cfg', 'tox.ini'])(
    'init leaves shared %s in place and names the SQLFluff section for the developer',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01, RF01\n';
        await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
        chmodSync(join(sandbox.path, path), 0o640);
        const initialized = await runGspot(sandbox.path, [
            'init',
            '--yes',
            '--json',
            '--configurations',
            'sql',
            '--no-task',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(readPolicy(sandbox.path).policy.ignores).toStrictEqual([]);
        expect((JSON.parse(initialized.stdout) as InitJson).plan!.remove.some((entry) => entry.path === path)).toBe(
            false,
        );
        expect((JSON.parse(initialized.stdout) as InitJson).plan!.retained).toContainEqual({
            path,
            note: textContaining('Delete the section when ready'),
        });
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, path)).mode & 0o777).toBe(getKeptMode(0o640));
    },
);

test('an ignore file inside a scope is replaced at init, and the scoped check runs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'db/accounts.sql': 'SELECT 1;\n',
        'db/.sqlfluffignore': '# Templates\ntemplates/\n',
    });
    commitAll(sandbox.path);
    const argv = [
        'init',
        '--yes',
        '--scope-configurations',
        'db=sql',
        '--no-task',
        '--no-ci',
        '--no-hooks',
        '--no-rules',
        '--no-install',
    ];
    const initialized = await runGspot(sandbox.path, argv);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(policy).not.toContain('templates');
    expect(existsSync(join(sandbox.path, 'db/.sqlfluffignore'))).toBe(false);
    const dialect = await runGspot(sandbox.path, ['set', 'tools.sqlfluff.dialect', 'postgres', '--scope', 'db']);
    expect(dialect.code, dialect.stdout + dialect.stderr).toBe(0);
    const syntax = await runGspot(sandbox.path, ['check', '--only', 'sql/syntax']);
    expect(syntax.code).toBe(0);
});

test.each([
    [
        'changes',
        (path: string) => {
            writeFileSync(path, 'disable=SC2034\n');
        },
    ],
    [
        'vanishes',
        (path: string) => {
            rmSync(path);
        },
    ],
])('a file init takes over that %s after the plan stops init before it writes', async (_, change) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(sandbox.path);
    const options = buildInitOptions(sandbox.path, {
        configurations: ['bash'],
        hooks: false,
        ci: 'none',
        runner: 'none',
        rules: false,
    });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.removed.map((entry) => entry.path)).toContain('.shellcheckrc');
    change(join(sandbox.path, '.shellcheckrc'));
    expect(await rejection(writeSetup(sandbox.path, options, prepared))).toContain('Run gspot init again');
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot'))).toBe(false);
});

test.each([true, false])(
    'initialization retains a shared authored link and its target bytes and mode (dry run: %s)',
    async (isDryRun) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01\n';
        await createFileTree(sandbox.path, { 'settings/shared.cfg': original, 'query.sql': 'SELECT 1;\n' });
        const target = join(sandbox.path, 'settings/shared.cfg');
        chmodSync(target, 0o640);
        symlinkSync('settings/shared.cfg', join(sandbox.path, 'setup.cfg'));
        const initialized = await runGspot(sandbox.path, [
            ...buildInitArguments(['sql']),
            '--json',
            ...(isDryRun ? ['--dry-run'] : []),
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const plan = (JSON.parse(initialized.stdout) as InitJson).plan!;
        expect(plan.retained).toContainEqual({
            path: 'setup.cfg',
            note: textContaining('Delete the section when ready'),
        });
        expect(plan.remove.some((entry) => entry.path === 'setup.cfg')).toBe(false);
        expect(readlinkSync(join(sandbox.path, 'setup.cfg'))).toBe('settings/shared.cfg');
        expect(readFileSync(target, 'utf8')).toBe(original);
        expect(statSync(target).mode & 0o777).toBe(getKeptMode(0o640));
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(!isDryRun);
        expect(existsSync(join(sandbox.path, '.gspot/config/sqlfluff.cfg'))).toBe(!isDryRun);
    },
);

test('initialization preserves a retained shared configuration edited after its plan', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });
    const options = buildInitOptions(sandbox.path, {
        configurations: ['sql'],
        hooks: false,
        ci: 'none',
        runner: 'none',
        rules: false,
    });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.retained).toContainEqual({
        path: 'setup.cfg',
        note: textContaining('Delete the section when ready'),
    });
    const edited = '[sqlfluff]\nexclude_rules = LT01, RF01\n[flake8]\nignore = E501\n';
    writeFileSync(join(sandbox.path, 'setup.cfg'), edited);
    const initialized = await writeSetup(sandbox.path, options, prepared);
    expect(initialized.exitCode).toBe(0);
    expect(readFileSync(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    expect(existsSync(join(sandbox.path, '.gspot/config/sqlfluff.cfg'))).toBe(true);
});
