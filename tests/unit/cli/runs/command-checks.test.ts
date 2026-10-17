import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { SARIF_LOCATION_CASES } from '#tests/data/tool-output.ts';
import { PENDING_NOTES_SCRIPT } from '#tests/data/runs/command-checks.ts';

test('a command check runs its command and reports file and line through its output format', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': String.raw`configurations = []

[[command_check]]
name = "notes/no-pending"
command = ${JSON.stringify([process.execPath, '-e', PENDING_NOTES_SCRIPT, '{files}'])}
paths = ["notes/**"]
stage = "commit"
summary = "Finds pending notes left in the notes folder."

[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        'notes/plan.txt': 'one\nPENDING later\n',
    });
    const check = await checkReport(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(1);
    expect(check.report.checks).toMatchObject([
        {
            check: 'notes/no-pending',
            status: 'failed',
            findings: [{ file: 'notes/plan.txt', line: 2, message: 'PENDING later' }],
        },
    ]);
});

test.each([...SARIF_LOCATION_CASES])(
    'a SARIF command check keeps a %s finding without made-up line and column',
    async (_name, physicalLocation) => {
        const report = {
            version: '2.1.0',
            runs: [
                {
                    results: [
                        {
                            message: { text: 'A reported defect.' },
                            locations: physicalLocation === undefined ? undefined : [{ physicalLocation }],
                        },
                    ],
                },
            ],
        };
        const command = [process.execPath, '-e', `process.stdout.write(${JSON.stringify(JSON.stringify(report))})`];
        await using sandbox = await testdir();
        const source = 'unchanged source\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([], {
                tables: `[[command_check]]
name = "notes/sarif"\ncommand=${JSON.stringify(command)}\npaths=["source.txt"]\nstage="commit"\n[command_check.output]\nformat="sarif"\n`,
            }),
            'source.txt': source,
        });
        const checked = await checkReport(sandbox.path, ['check', '--only', 'notes/sarif', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const result = checked.report.checks.find((entry) => entry.check === 'notes/sarif')!;
        expect(result.status).toBe('failed');
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            file: physicalLocation === undefined ? '' : 'source.txt',
            message: 'A reported defect.',
            fixable: false,
        });
        expect(result.findings[0]).not.toHaveProperty('line');
        expect(result.findings[0]).not.toHaveProperty('column');
        expect(await Bun.file(join(sandbox.path, 'source.txt')).text()).toBe(source);
    },
);
