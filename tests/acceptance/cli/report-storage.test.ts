import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { chmodSync, statSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { run } from '#tests/harness/planted.ts';
import type { RunReport } from '#types/report.ts';

test.skipIf(process.platform === 'win32')(
    'a read-only report directory preserves CLI findings and verdict',
    async () => {
        const command = [process.execPath, '-e', "console.log('Retained CLI finding'); process.exitCode = 1"];
        await using sandbox = await createSandbox({
            'source.txt': 'original',
            '.gspot/sentinel': 'keep',
            'gspot.toml': `version = 1
presets = []
[[check]]
name = "sandbox/storage"
command = ${JSON.stringify(command)}
paths = ["source.txt"]
stage = "commit"
[check.output]
format = "lines"
`,
        });
        const directory = join(sandbox.path, '.gspot');
        const mode = statSync(directory).mode & 0o777;
        chmodSync(directory, 0o500);
        try {
            const result = await run(sandbox.path, ['check', '--json', '--no-cache']);
            expect(result.code).toBe(1);
            const report = JSON.parse(result.stdout) as RunReport;
            expect(report.checks[0]?.findings[0]?.message).toBe('Retained CLI finding');
            expect(report.exitCode).toBe(1);
            expect(result.stderr).toContain('report.json');
            expect(result.stderr.trim().split('\n')).toHaveLength(1);
        } finally {
            chmodSync(directory, mode);
        }
    },
);
