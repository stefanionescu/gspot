// Table settings accept TOML input. Unparsable values and quoted policy tables are rejected.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { TABLE, TYPED_TABLES_INIT } from '#tests/config/acceptance/source/cli/cli.ts';

describe('gspot set', () => {
    test(
        'a list of tables typed the TOML way lands in the policy as tables',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'README.md': '# planted\n', LICENSE: 'MIT\n' });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(sandbox.path, TYPED_TABLES_INIT, environment);
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
                `${policy}\n[tools.typos]\nexclude = ['{paths = ["a"], reason = "x"}']\n`,
            );
            const args = ['check', '--only', 'docs/links', '--json'];
            const read = await run(sandbox.path, args, environment);
            expect(read.code, read.stdout + read.stderr).toBe(1);
            expect(reportSchema.parse(JSON.parse(read.stdout)).checks).toMatchObject([
                { check: 'docs/links', status: 'ok', findings: [] },
                {
                    check: 'integrity/policy',
                    status: 'fail',
                    findings: [
                        {
                            file: 'gspot.toml',
                            message: expect.stringContaining('holds a table written inside quotes') as unknown,
                        },
                    ],
                },
            ]);
            await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
            const corrected = await run(sandbox.path, args, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'docs/links', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
