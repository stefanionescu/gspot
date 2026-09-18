// Planted repository for the structure preset: each repository-shape check fires on its planted defect.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, git, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const INIT = ['init', '--yes', '--presets', 'bash', '--runner', 'none', '--ci', 'none', '--no-rules', '--no-install'];

describe('the structure preset', () => {
    test(
        'integrity/tracked-dependencies reports a dependency folder that git tracks',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script, 'scripts/b.sh': script });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            run(fixture.path, INIT, environment);
            expect(run(fixture.path, ['check', 'integrity/tracked-dependencies'], environment).code).toBe(0);
            mkdirSync(join(fixture.path, 'web', 'node_modules', 'left-pad'), { recursive: true });
            await Bun.write(join(fixture.path, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
            git(fixture.path, ['add', '-f', 'web/node_modules/left-pad/index.js']);
            const check = run(fixture.path, ['check', 'integrity/tracked-dependencies', '--no-cache'], environment);
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('git tracks 1 file(s) under web/node_modules/');
        },
        PLANTED_TIMEOUT_MS,
    );
});
