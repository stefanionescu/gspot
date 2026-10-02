// Replace at init: the plan names hand-written hooks, deletes the files of the selected tools, and lists the lint folder.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/cli/git.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { script } from '#tests/harness/planted/cases.ts';
import { keptMode } from '#tests/harness/cli/platforms.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { statSync, chmodSync, existsSync, readFileSync } from 'node:fs';

const PLAN_INIT = [
    'init',
    '--yes',
    '--kits',
    'bash',
    'javascript',
    'spelling',
    'markdown',
    '--no-runner',
    '--no-ci',
    '--no-guides',
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
        const configured = hooksPath === '' ? { code: 0 } : git(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        expect(configured.code).toBe(0);
        const result = await run(sandbox.path, [...PLAN_INIT, '--dry-run']);
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
    PLANTED_TIMEOUT_MS,
);

// The ESLint pointer is written for editors; the other deleted files get no pointer, because each check names
// its configuration by path.
function expectPointers(root: string): void {
    for (const gone of ['typos.toml', '.shellcheckrc', '.markdownlint-cli2.jsonc'])
        expect(existsSync(join(root, gone))).toBe(false);
    const eslintPointer = ['eslint.config.js', 'eslint.config.mjs'].find((name) => existsSync(join(root, name)));
    expect(eslintPointer).toBeDefined();
    expect(readFileSync(join(root, eslintPointer ?? ''), 'utf8')).toContain('gspot');
}

test(
    'replaces the files of the selected tools and lists the lint folder',
    async () => {
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
            'scripts/a.sh': script,
            'src/a.js': 'export const a = 1;\n',
            'README.md': '# planted\n',
            'quality/lint.sh': script,
        });
        git(sandbox.path, ['init', '-q']);
        git(sandbox.path, ['add', '-A']);
        git(sandbox.path, ['commit', '-qm', 'init']);
        const environment = { PATH: toolsPath(['ast-grep']) };
        const preview = await run(sandbox.path, [...PLAN_INIT, '--dry-run', '--json'], environment);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        const plan = (JSON.parse(preview.stdout) as InitJson).plan!;
        for (const path of Object.keys(originals))
            expect(plan.remove).toContainEqual({ path, note: textContaining('replaced by the generated') });
        expect(plan.noLongerRuns).toContainEqual({ path: 'quality/', note: textContaining('lint scripts') });
        const init = await run(sandbox.path, PLAN_INIT, environment);
        expect(init.code, init.stdout + init.stderr).toBe(0);
        expect(init.stdout).toContain('quality/');
        const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        for (const carried of ['udid', 'SC2086', 'MD013']) expect(policy).not.toContain(carried);
        expectPointers(sandbox.path);
        for (const path of ['.markdownlint.jsonc', '.eslintrc.json', '.prettierrc'])
            expect(existsSync(join(sandbox.path, path))).toBe(false);
        expect(existsSync(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
        const applied = await run(sandbox.path, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(applied.stdout) as { drift: unknown[] }).drift).toStrictEqual([]);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 2,
);

test.each(['setup.cfg', 'tox.ini'])(
    'init leaves shared %s in place and names the SQLFluff section for the developer',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01, RF01\n';
        await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
        chmodSync(join(sandbox.path, path), 0o640);
        const initialized = await run(sandbox.path, [
            'init',
            '--yes',
            '--json',
            '--kits',
            'sql',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
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
        expect(statSync(join(sandbox.path, path)).mode & 0o777).toBe(keptMode(0o640));
    },
    PLANTED_TIMEOUT_MS,
);
