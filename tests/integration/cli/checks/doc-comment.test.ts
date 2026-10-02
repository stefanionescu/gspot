import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';

test.each(['colon', 'dash'])(
    'Bash documentation preserves %s summaries and rejects reversed sections',
    async (style) => {
        await using sandbox = await testdir();
        const summary = `# _show${style === 'colon' ? ': ' : ' - '}prints the supplied name.\n`;
        const body = '_show() {\n    printf "%s\\n" "$1"\n}\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash'], `[tools.bash]\ndoc_style = "${style}"\n`, 'all'),
            'show.sh': summary + '# Returns:\n# Arguments:\n' + body,
        });
        const options = {
            stage: 'all' as const,
            skips: [],
            only: ['structure/doc-comment'],
            fix: false,
            isDryRun: true,
        };
        const failed = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
        expect(failed.report.exitCode).toBe(1);
        expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'show.sh', line: 4, rule: 'section-order' },
        ]);
        await Bun.write(`${sandbox.path}/show.sh`, summary + '# Arguments:\n# Returns:\n' + body);
        const corrected = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'ok', findings: [] }]);
    },
);
