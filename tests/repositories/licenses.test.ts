// Planted repository for the licenses preset: a package under a license outside the list, and an exception that went stale.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const NPM_BIN = join(import.meta.dir, '../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'licenses',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const ROOT = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n';

function installed(name: string, license: string): string {
    return `{\n    "name": "${name}",\n    "version": "1.0.0",\n    "license": "${license}"\n}\n`;
}

describe('the licenses preset', () => {
    test(
        'a license outside the list fails, an exception that names it passes, and one that names another fails',
        async () => {
            await using fixture = await createFixture({
                'package.json': ROOT,
                '.gitignore': 'node_modules/\n',
                'node_modules/kind/package.json': installed('kind', 'MIT'),
            });
            commitAll(fixture.path);
            const environment = { PATH: `${NPM_BIN}:${toolsPath(['typos', 'ec'])}` };
            run(fixture.path, INIT, environment);
            expect(run(fixture.path, ['check', 'licenses/npm', '--no-cache'], environment).code).toBe(0);
            await Bun.write(
                join(fixture.path, 'node_modules/strict/package.json'),
                installed('strict', 'GPL-3.0-only'),
            );
            const refused = run(fixture.path, ['check', 'licenses/npm', '--no-cache'], environment);
            expect(refused.code, refused.stdout + refused.stderr).toBe(1);
            expect(refused.stdout).toContain('strict@1.0.0 reports GPL-3.0-only');
            expect(refused.stdout).not.toContain('kind@1.0.0');
            const policy = join(fixture.path, 'gspot.toml');
            const before = await Bun.file(policy).text();
            const exception = (license: string): string =>
                `${before}\n[[tools.licenses.exceptions]]\npackage = "strict@1.0.0"\nlicense = "${license}"\nreason = "Used at build time only, never shipped."\n`;
            await Bun.write(policy, exception('GPL-3.0-only'));
            const accepted = run(fixture.path, ['check', 'licenses/npm', '--no-cache'], environment);
            expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
            await Bun.write(policy, exception('LGPL-3.0-only'));
            const stale = run(fixture.path, ['check', 'licenses/npm', '--no-cache'], environment);
            expect(stale.code).toBe(1);
            expect(stale.stdout).toContain('the exception no longer holds');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
