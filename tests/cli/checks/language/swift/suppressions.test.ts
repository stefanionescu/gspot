import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';

test.each(['swiftformat:disable blockComments', 'periphery:ignore'])(
    'Swift suppression %s requires a reason and preserves source bytes',
    async (directive) => {
        await using sandbox = await testdir();
        const source = `// ${directive}\npublic let value = 1\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
            'Value.swift': source,
        });
        const command = ['check', '--only', 'gspot/suppressions', '--json'];
        const failed = await checkReport(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks).toMatchObject([
            { status: 'failed', findings: [{ file: 'Value.swift', line: 1 }] },
        ]);
        expect(await Bun.file(join(sandbox.path, 'Value.swift')).text()).toBe(source);
        const correction = source.replace(
            `// ${directive}`,
            `// ${directive} - The external declaration retains its layout.`,
        );
        await Bun.write(join(sandbox.path, 'Value.swift'), correction);
        const passed = await checkReport(sandbox.path, command);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(await Bun.file(join(sandbox.path, 'Value.swift')).text()).toBe(correction);
    },
);
