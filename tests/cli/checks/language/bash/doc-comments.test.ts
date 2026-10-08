import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

test.each(['colon', 'dash'])(
    'Bash documentation rejects the %s sample and accepts ordered colon summaries',
    async (style) => {
        await using sandbox = await testdir();
        const summary = `# _show${style === 'colon' ? ': ' : ' - '}prints the supplied name.\n`;
        const body = '_show() {\n    printf "%s\\n" "$1"\n}\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
            'show.sh': summary + '# Returns:\n# Arguments:\n' + body,
        });
        const options = buildRunOptions({ only: ['bash/doc-comments'] });
        const failed = await executeRun(await openSession(sandbox.path), options);
        expect(failed.report.exitCode).toBe(1);
        expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'show.sh', line: 4, rule: style === 'colon' ? 'section-order' : 'summary-line' },
        ]);
        await Bun.write(
            `${sandbox.path}/show.sh`,
            '# _show: prints the supplied name.\n# Arguments:\n# Returns:\n' + body,
        );
        const corrected = await executeRun(await openSession(sandbox.path), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);
