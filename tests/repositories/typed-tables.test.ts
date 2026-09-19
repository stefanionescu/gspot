// gspot set with a table for a value: the TOML form is read, text that reads as nothing is refused, and a quoted table in the policy is refused at load.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'markdown,docs',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const REASON = 'The report names the folders the move deleted, which is what it is for.';
const TABLE = `[{patterns = ["REPORT.md"], reason = "${REASON}"}]`;

describe('gspot set', () => {
    test(
        'a list of tables typed the TOML way lands in the policy as tables',
        async () => {
            await using fixture = await createFixture({ 'README.md': '# planted\n', LICENSE: 'MIT\n' });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            const written = run(fixture.path, ['set', 'tools.docs.paths_allowed', TABLE], environment);
            expect(written.code, written.stdout + written.stderr).toBe(0);
            const policy = await Bun.file(join(fixture.path, 'gspot.toml')).text();
            expect(policy).toContain('patterns = ["REPORT.md"]');
            expect(policy).not.toContain('"[{patterns');

            const unreadable = run(fixture.path, ['set', 'tools.docs.paths_allowed', '[{patterns = '], environment);
            expect(unreadable.code).toBe(2);
            expect(unreadable.stdout + unreadable.stderr).toContain('reads as neither JSON nor TOML');

            // A person can still type the quotes by hand, and the policy refuses that when it loads.
            await Bun.write(
                join(fixture.path, 'gspot.toml'),
                `${policy}\n[tools.typos]\nexclude = ["{paths = [\\"a\\"], reason = \\"x\\"}"]\n`,
            );
            const read = run(fixture.path, ['check', 'docs/readme-present'], environment);
            expect(read.code).toBe(2);
            expect(read.stdout + read.stderr).toContain('holds a table written inside quotes');
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
