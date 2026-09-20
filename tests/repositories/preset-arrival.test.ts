import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
// A preset added after init: what it finds today is held, and only the checks it brings or changes run for that.
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript',
    '--without',
    'naming,spelling',
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
        'a preset that only adds an ESLint fragment has its findings held, and the rest of the gate does not run',
        async () => {
            await using fixture = await createFixture({
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["src"]\n}\n',
                'src/schema.ts': LOOSE,
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(fixture.path, INIT, environment);
            const before = await run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(before.code, before.stdout + before.stderr).toBe(0);
            const added = await run(fixture.path, ['add', 'zod', '--json'], environment);
            expect(added.code, added.stdout + added.stderr).toBe(0);
            expect(added.stdout).not.toContain('formatting/prettier');
            const after = await run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(after.code, after.stdout + after.stderr).toBe(0);
            const held = await Bun.file(join(fixture.path, '.gspot/baselines/eslint.json')).text();
            expect(held).toContain('zod/no-any-schema');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
