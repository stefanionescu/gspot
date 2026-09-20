import * as fs from 'node:fs';
import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import { readCached } from '#cli/run/cache.ts';
import type { Stage } from '#types/manifest.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';
import { rejects, throws } from 'node:assert/strict';

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
                    name: 'sandbox/storage',
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
        await using sandbox = await createSandbox({
            'gspot.toml': 'version = 1\npresets = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await sessionFor(sandbox.path, status);
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
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n',
        'source.ts': 'export {};\n',
        '.gspot/report.json': 'previous JSON',
        '.gspot/report.sarif': 'previous SARIF',
    });
    const session = await sessionFor(sandbox.path, 0, 'message');
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
    expect(fs.readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8')).toBe('previous JSON');
    expect(fs.readFileSync(join(sandbox.path, '.gspot/report.sarif'), 'utf8')).toBe('previous SARIF');
});

test.each([false, true])('unreadable selected sources reject a run with noCache=%s', async (noCache) => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n',
        'source.ts': 'export {};\n',
    });
    const session = await sessionFor(sandbox.path, 0);
    const options = { stage: 'commit' as const, skips: [], localSkips: [], fix: false, isDryRun: false, noCache };
    const original = await executeRun(session, options);
    expect(original.report.exitCode).toBe(0);
    const report = fs.readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8');
    fs.rmSync(join(sandbox.path, 'source.ts'));
    fs.mkdirSync(join(sandbox.path, 'source.ts'));
    await rejects(executeRun(session, options), { code: 'EISDIR' });
    expect(fs.readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8')).toBe(report);
});

test('an absent tool baseline is optional but an unreadable baseline rejects the run', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n',
        'source.ts': 'export {};\n',
    });
    const session = await sessionFor(sandbox.path, 0);
    session.scopes[0]!.selected[0]!.checks[0]!.baseline_file = 'tool-baseline.json';
    const options = { stage: 'commit' as const, skips: [], localSkips: [], fix: false, isDryRun: false };
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    fs.mkdirSync(join(sandbox.path, 'tool-baseline.json'));
    await rejects(executeRun(session, options), { code: 'EISDIR' });
});

test.each(['{', '{"status":"ok","findings":[]}'])(
    'invalid cached result %s refuses the run and preserves the prior report',
    async (content) => {
        await using sandbox = await createSandbox({
            'gspot.toml': 'version = 1\npresets = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await sessionFor(sandbox.path, 1);
        const options = { stage: 'commit' as const, skips: [], localSkips: [], fix: false, isDryRun: false };
        const initial = await executeRun(session, options);
        expect(initial.report.exitCode).toBe(1);
        const reportPath = join(sandbox.path, '.gspot/report.json');
        const report = fs.readFileSync(reportPath, 'utf8');
        const cache = join(sandbox.path, '.gspot/cache');
        const [entry] = fs.readdirSync(cache);
        fs.writeFileSync(join(cache, entry!), content);
        await rejects(executeRun(session, options), /Could not read cached check result/);
        expect(fs.readFileSync(reportPath, 'utf8')).toBe(report);
    },
);

test('a denied cache read reports its path and cause', async () => {
    await using sandbox = await createSandbox({ '.gspot/cache/entry.json': '{}' });
    const path = join(sandbox.path, '.gspot/cache/entry.json');
    const failure = Object.assign(new Error('Denied cache read'), { code: 'EACCES' });
    const reads = spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw failure;
    });
    try {
        throws(() => readCached(sandbox.path, 'entry'), {
            message: `Could not read cached check result ${path}: Error: Denied cache read`,
            cause: failure,
        });
    } finally {
        reads.mockRestore();
    }
});
