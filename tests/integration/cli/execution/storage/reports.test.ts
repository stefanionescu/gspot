import * as fs from 'node:fs';
import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import { runText } from '#cli/output/reporter.ts';
import { createFileTree, testdir } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { storageSession } from '#tests/support/cli/storage.ts';

for (const target of ['cache', 'report.json', 'report.sarif', 'report.codequality.json']) {
    test.each([0, 1])(`${target} write failure preserves check status %s and findings`, async (status) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await storageSession(sandbox.path, status);
        fs.mkdirSync(join(sandbox.path, '.gspot'), { recursive: true });
        const obstruction = join(sandbox.path, '.gspot', target === 'cache' ? target : `reports/${target}`);
        if (target === 'cache') fs.writeFileSync(obstruction, 'authored obstruction\n');
        else fs.mkdirSync(obstruction, { recursive: true });
        const stderr = spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            const outcome = await executeRun(session, {
                stage: 'commit',
                skips: [],
                fix: false,
                isDryRun: false,
            });
            expect(outcome.report.exitCode).toBe(status);
            expect(outcome.report.checks[0]?.status).toBe(status === 0 ? 'ok' : 'fail');
            expect(outcome.report.checks[0]?.findings).toHaveLength(status);
            const output = runText(outcome.report, { quiet: false, verbose: false });
            expect(output).toContain(status === 0 ? '1 check passed' : 'Retained finding');
            const diagnostics = stderr.mock.calls.map((call) => String(call[0])).join('');
            expect(diagnostics).toContain(target);
            expect(diagnostics).toContain('Could not write');
            if (target === 'cache') expect(fs.readFileSync(obstruction, 'utf8')).toBe('authored obstruction\n');
            else expect(fs.statSync(obstruction).isDirectory()).toBe(true);
            expect(diagnostics.trim().split('\n')).toHaveLength(1);
        } finally {
            stderr.mockRestore();
        }
    });
}

test('the message stage preserves the prior report files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.ts': 'export {};\n',
        '.gspot/reports/report.json': 'previous JSON',
        '.gspot/reports/report.sarif': 'previous SARIF',
        '.gspot/reports/report.codequality.json': 'previous GitLab',
    });
    const session = await storageSession(sandbox.path, 0, 'message');
    const outcome = await executeRun(session, {
        stage: 'message',
        skips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    expect(outcome.report.checks).toHaveLength(1);
    expect(outcome.report.exitCode).toBe(0);
    expect(fs.readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8')).toBe('previous JSON');
    expect(fs.readFileSync(join(sandbox.path, '.gspot/reports/report.sarif'), 'utf8')).toBe('previous SARIF');
    expect(fs.readFileSync(join(sandbox.path, '.gspot/reports/report.codequality.json'), 'utf8')).toBe(
        'previous GitLab',
    );
});

test.each([false, true])('unreadable selected sources reject a run with noCache=%s', async (noCache) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.ts': 'export {};\n',
    });
    const session = await storageSession(sandbox.path, 0);
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false, noCache };
    const original = await executeRun(session, options);
    expect(original.report.exitCode).toBe(0);
    const report = fs.readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8');
    fs.rmSync(join(sandbox.path, 'source.ts'));
    fs.mkdirSync(join(sandbox.path, 'source.ts'));
    await rejects(executeRun(session, options), { code: 'EISDIR' });
    expect(fs.readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8')).toBe(report);
});

test('a dry run does not create cache, report, or ownership files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.ts': 'export {};\n',
    });
    const before = fs.readdirSync(sandbox.path, { recursive: true });
    const outcome = await executeRun(await storageSession(sandbox.path, 0), {
        stage: 'commit',
        skips: [],
        fix: false,
        isDryRun: true,
    });
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]?.status).toBe('ok');
    expect(fs.readdirSync(sandbox.path, { recursive: true })).toStrictEqual(before);
    expect(fs.readFileSync(join(sandbox.path, 'source.ts'), 'utf8')).toBe('export {};\n');
});
