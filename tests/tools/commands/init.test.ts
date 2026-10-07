// Init deletes the files of the selected tools, writes the editor pointer, and leaves nothing for apply to change.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/git.ts';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { PLAN_INIT } from '#tests/config/tools/commands/init.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { buildToolsPath, installToolProjects } from '#tests/harness/install.ts';

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
            'scripts/a.sh': CLEAN_BASH_SCRIPT,
            'src/a.js': 'export const a = 1;\n',
            'README.md': '# test\n',
            'quality/lint.sh': CLEAN_BASH_SCRIPT,
        });
        git(sandbox.path, ['init', '-q']);
        git(sandbox.path, ['add', '-A']);
        git(sandbox.path, ['commit', '-qm', 'init']);
        const environment = { PATH: buildToolsPath(['ast-grep']) };
        const init = await spawnGspot(sandbox.path, PLAN_INIT, environment);
        expect(init.code, init.stdout + init.stderr).toBe(0);
        const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        for (const carried of ['udid', 'SC2086', 'MD013']) expect(policy).not.toContain(carried);
        expectPointers(sandbox.path);
        for (const path of ['.markdownlint.jsonc', '.eslintrc.json', '.prettierrc'])
            expect(existsSync(join(sandbox.path, path))).toBe(false);
        expect(existsSync(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
        await installToolProjects(sandbox.path);
        const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(applied.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
