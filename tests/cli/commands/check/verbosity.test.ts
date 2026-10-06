// Bun tests select one check-report detail while JSON retains every finding and check state.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { FINDINGS_SHOWN } from '#cli/config/output.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { VERBOSITY_ARGS, VERBOSITY_CASES } from '#tests/config/cli/commands/verbosity.ts';

test.each([...VERBOSITY_CASES])(
    'check uses $name consistently and preserves full JSON',
    async ({ flags, verbosity }) => {
        await using sandbox = await testdir();
        const checks = [
            { name: 'example/findings', command: [process.execPath, 'findings.ts'], output: { format: 'lines' } },
            { name: 'example/passing', command: [process.execPath, '-e', 'process.exitCode=0;'] },
        ].map((check) => ({ ...check, paths: ['source.txt'], stage: 'commit' }));
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({ configurations: [], check: checks }),
            'source.txt': 'before',
            'findings.ts': 'process.stdout.write(await Bun.file("findings.txt").text()); process.exitCode=1;',
            'findings.txt':
                Array.from({ length: FINDINGS_SHOWN + 1 }, (_, index) => `finding ${String(index + 1)}.`).join('\n') +
                '\n',
        });
        commitAll(sandbox.path);
        await Bun.write(join(sandbox.path, 'source.txt'), 'after');
        const result = await runGspot(sandbox.path, [...flags, ...VERBOSITY_ARGS]);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.stderr.split('\n').filter((line) => line.startsWith('root  example/'))).toStrictEqual([
            'root  example/findings  failed',
        ]);
        expect(result.stdout).not.toContain('root  example/findings  failed\n');
        expect(result.stdout.includes('example/passing')).toBe(verbosity !== 'quiet');
        expect(result.stdout.includes('Working tree compared')).toBe(verbosity !== 'quiet');
        expect(result.stdout.includes(`finding ${String(FINDINGS_SHOWN + 1)}.`)).toBe(verbosity === 'verbose');
        expect(result.stdout.includes('and 1 more')).toBe(verbosity !== 'verbose');
        expect(result.stdout.includes('$ ')).toBe(verbosity === 'verbose');
        const json = await runGspot(sandbox.path, ['--json', ...flags, ...VERBOSITY_ARGS]);
        expect(json.code, json.stdout + json.stderr).toBe(1);
        const report = JSON.parse(json.stdout) as RunReport;
        expect(report.checks.find((check) => check.check === 'example/findings')?.findings).toHaveLength(
            FINDINGS_SHOWN + 1,
        );
        expect(report.checks.find((check) => check.check === 'example/passing')?.status).toBe('passed');
        expect(json.stderr).toBe('');
        await Bun.write(join(sandbox.path, 'findings.ts'), 'process.exitCode=0;');
        const repaired = await runGspot(sandbox.path, [...flags, ...VERBOSITY_ARGS]);
        expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
        expect(repaired.stderr.split('\n').filter((line) => line.startsWith('root  example/'))).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe('after');
    },
);
