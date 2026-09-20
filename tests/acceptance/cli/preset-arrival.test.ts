// Adding a preset changes the next explicit check through its ESLint fragment.
import { delimiter, join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { symlinkSync, readdirSync } from 'node:fs';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript',
    '--without',
    'naming',
    'spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const PACKAGE = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n';
const LOOSE =
    "// A planted file.\n\nimport { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.any();\n";

describe('gspot add', () => {
    test(
        'adding an ESLint fragment exposes its defect on the next explicit check',
        async () => {
            await using sandbox = await createSandbox({
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["*.ts"]\n}\n',
                'schema.ts': LOOSE,
                node_modules: null,
            });
            for (const entry of readdirSync(MODULES))
                symlinkSync(join(MODULES, entry), join(sandbox.path, 'node_modules', entry));
            symlinkSync(join(MODULES, '../packages/cli/node_modules/zod'), join(sandbox.path, 'node_modules/zod'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(sandbox.path, INIT, environment);
            const before = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(before.code, before.stdout + before.stderr).toBe(0);
            const added = await run(sandbox.path, ['add', 'zod', '--json'], environment);
            expect(added.code, added.stdout + added.stderr).toBe(0);
            const after = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(after.code, after.stdout + after.stderr).toBe(1);
            expect(after.stdout).toContain('zod/no-any-schema');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
