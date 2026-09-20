import * as fs from 'node:fs';
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { expect, spyOn, test } from 'bun:test';
import type { Stage } from '#types/manifest.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';

async function sessionFor(root: string, status: number, stage: Stage = 'commit') {
    const session = await openSession(root);
    const manifest = session.manifests.get('typescript')!;
    const script = status === 0 ? 'process.exitCode = 0' : "console.log('Retained finding'); process.exitCode = 1";
    session.scopes[0]!.selected = [
        {
            ...manifest,
            tools: [],
            checks: [
                {
                    runs: 'per-scope',
                    coverage: [],
                    summary: 'Reports the planted storage finding.',
                    why: 'Storage failures preserve the check result.',
                    help: 'Fix the planted finding.',
                    claims: manifest.claims,
                    name: 'fixture/storage',
                    stage,
                    cwd: 'root',
                    command: [process.execPath, '-e', script],
                    output: { format: 'lines' },
                },
            ],
        },
    ];
    return session;
}

for (const target of ['cache', 'report.json', 'report.sarif']) {
    test.each([0, 1])(`${target} write failure preserves check status %s and findings`, async (status) => {
        await using fixture = await createFixture({
            'gspot.toml': 'version = 1\npresets = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await sessionFor(fixture.path, status);
        const write = fs.writeFileSync;
        const failure = Object.assign(new Error('Planted disk failure.\nSecond line.'), { code: 'ENOSPC' });
        const writes = spyOn(fs, 'writeFileSync').mockImplementation((path, ...args) => {
            if (String(path).includes(target)) throw failure;
            write(path, ...args);
        });
        const stderr = spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            const outcome = await executeRun(session, {
                stage: 'commit',
                skips: [],
                localSkips: [],
                fix: false,
                isDryRun: false,
            });
            expect(outcome.report.exitCode).toBe(status);
            expect(outcome.report.checks[0]?.status).toBe(status === 0 ? 'ok' : 'fail');
            expect(outcome.report.checks[0]?.findings).toHaveLength(status);
            const output = runText(outcome.report, { quiet: false, verbose: false });
            expect(output).toContain(status === 0 ? 'passed:' : 'Retained finding');
            const diagnostics = stderr.mock.calls.map((call) => String(call[0])).join('');
            expect(diagnostics).toContain(target);
            expect(diagnostics).toContain('Planted disk failure. Second line.');
            expect(diagnostics.trim().split('\n')).toHaveLength(1);
        } finally {
            writes.mockRestore();
            stderr.mockRestore();
        }
    });
}

test('the message stage preserves the prior report files', async () => {
    await using fixture = await createFixture({
        'gspot.toml': 'version = 1\npresets = []\n',
        'source.ts': 'export {};\n',
        '.gspot/report.json': 'previous JSON',
        '.gspot/report.sarif': 'previous SARIF',
    });
    const session = await sessionFor(fixture.path, 0, 'message');
    const outcome = await executeRun(session, {
        stage: 'message',
        skips: [],
        localSkips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    expect(outcome.report.checks).toHaveLength(1);
    expect(outcome.report.exitCode).toBe(0);
    expect(fs.readFileSync(join(fixture.path, '.gspot/report.json'), 'utf8')).toBe('previous JSON');
    expect(fs.readFileSync(join(fixture.path, '.gspot/report.sarif'), 'utf8')).toBe('previous SARIF');
});
