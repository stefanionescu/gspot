// Init deletes the files of the selected tools, writes the editor pointer, and leaves nothing for apply to change.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/cli/git.ts';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { script } from '#tests/harness/planted/cases.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';

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
    '--no-rules',
    '--no-install',
];

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
    'init replaces the files of the selected tools and leaves no drift for apply',
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
        const init = await spawnGspot(sandbox.path, PLAN_INIT, environment);
        expect(init.code, init.stdout + init.stderr).toBe(0);
        const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        for (const carried of ['udid', 'SC2086', 'MD013']) expect(policy).not.toContain(carried);
        expectPointers(sandbox.path);
        for (const path of ['.markdownlint.jsonc', '.eslintrc.json', '.prettierrc'])
            expect(existsSync(join(sandbox.path, path))).toBe(false);
        expect(existsSync(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
        const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(applied.stdout) as { drift: unknown[] }).drift).toStrictEqual([]);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 2,
);
