import { createFixture } from 'fs-fixture';
// Planted repository for the duplication preset: one block copied into a second file.
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const NPM_BIN = join(import.meta.dir, '../../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'bash,duplication',
    '--without',
    'naming',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const STEPS = Array.from(
    { length: 30 },
    (_, index) => `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
).join('\n');
const copied = (name: string): string =>
    `#!/usr/bin/env bash\nset -euo pipefail\n\n${name}() {\n    local total=0\n${STEPS}\n    printf '%s\\n' "$total"\n}\n\n${name}\n`;

describe('the duplication preset', () => {
    test(
        'a block copied between two files is a finding on the file that holds it',
        async () => {
            await using fixture = await createFixture({ 'scripts/first.sh': copied('count_first') });
            commitAll(fixture.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['shellcheck', 'shfmt', 'typos', 'ec'])}` };
            await install(fixture.path, INIT, environment);
            const clean = await run(fixture.path, ['check', 'duplication/jscpd', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            await Bun.write(`${fixture.path}/scripts/second.sh`, copied('count_second'));
            commitAll(fixture.path);
            const found = await run(fixture.path, ['check', 'duplication/jscpd', '--no-cache'], environment);
            expect(found.code, found.stdout + found.stderr).toBe(1);
            expect(found.stdout).toContain('lines repeat scripts/');
            expect(found.stdout).toContain('over the ceiling of 4');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
