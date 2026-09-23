// gspot set with a table for a value: the TOML form is read, text that reads as nothing is refused, and a quoted table in the policy is refused at load.
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/support/cli/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'markdown',
    'docs',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const REASON = 'The report names the folders the move deleted, which is what it is for.';
const TABLE = `[{patterns = ["REPORT.md"], reason = "${REASON}"}]`;

describe('gspot set', () => {
    test(
        'a list of tables typed the TOML way lands in the policy as tables',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'README.md': '# planted\n', LICENSE: 'MIT\n' });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const written = await run(sandbox.path, ['set', 'tools.docs.paths_allowed', TABLE], environment);
            expect(written.code, written.stdout + written.stderr).toBe(0);
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('patterns = ["REPORT.md"]');
            expect(policy).not.toContain('"[{patterns');

            const unreadable = await run(
                sandbox.path,
                ['set', 'tools.docs.paths_allowed', '[{patterns = '],
                environment,
            );
            expect(unreadable.code).toBe(2);
            expect(unreadable.stdout + unreadable.stderr).toContain('reads as neither JSON nor TOML');

            // A person can still type the quotes by hand, and the policy refuses that when it loads.
            await Bun.write(
                join(sandbox.path, 'gspot.toml'),
                `${policy}\n[tools.typos]\nexclude = ["{paths = [\\"a\\"], reason = \\"x\\"}"]\n`,
            );
            const read = await run(sandbox.path, ['check', '--only', 'docs/readme-present'], environment);
            expect(read.code).toBe(2);
            expect(read.stdout + read.stderr).toContain('holds a table written inside quotes');
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
