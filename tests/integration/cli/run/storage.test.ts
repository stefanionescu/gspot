import * as fs from 'node:fs';
import { join } from 'node:path';
import * as cache from '#cli/run/cache.ts';
import { expect, spyOn, test } from 'bun:test';
import { readCached } from '#cli/run/cache.ts';
import { executeRun } from '#cli/run/execute.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/schemas/reports.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';
import { createFileTree, testdir } from 'testdirs';
import { rejects, throws } from 'node:assert/strict';
import type { Stage } from '#cli/types/configurations.ts';

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
                    level: 'recommended',
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

for (const target of ['cache', 'report.json', 'report.sarif', 'report.codequality.json']) {
    test.each([0, 1])(`${target} write failure preserves check status %s and findings`, async (status) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await sessionFor(sandbox.path, status);
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
    const session = await sessionFor(sandbox.path, 0, 'message');
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
    const session = await sessionFor(sandbox.path, 0);
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false, noCache };
    const original = await executeRun(session, options);
    expect(original.report.exitCode).toBe(0);
    const report = fs.readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8');
    fs.rmSync(join(sandbox.path, 'source.ts'));
    fs.mkdirSync(join(sandbox.path, 'source.ts'));
    await rejects(executeRun(session, options), { code: 'EISDIR' });
    expect(fs.readFileSync(join(sandbox.path, '.gspot/reports/report.json'), 'utf8')).toBe(report);
});

test.each(['{', '{"status":"ok","findings":[]}'])(
    'an edited cached result %s is preserved and the check runs again',
    async (content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n',
            'source.ts': 'export {};\n',
        });
        const session = await sessionFor(sandbox.path, 1);
        const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
        const initial = await executeRun(session, options);
        expect(initial.report.exitCode).toBe(1);
        const reportPath = join(sandbox.path, '.gspot/reports/report.json');
        const cache = join(sandbox.path, '.gspot/cache');
        const [entry] = fs.readdirSync(cache);
        fs.writeFileSync(join(cache, entry!), content);
        const stderr = spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            const repeated = await executeRun(session, options);
            expect(repeated.report.exitCode).toBe(1);
            expect(repeated.report.checks[0]?.findings[0]?.message).toBe('Retained finding');
            expect(fs.readFileSync(join(cache, entry!), 'utf8')).toBe(content);
            expect(JSON.parse(fs.readFileSync(reportPath, 'utf8'))).toStrictEqual(repeated.report);
            expect(stderr.mock.calls.map((call) => String(call[0])).join('')).toContain(
                'Preserved edited or unowned cache',
            );
        } finally {
            stderr.mockRestore();
        }
    },
);

test('a denied owned cache read reports its path and cause', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.ts': 'export {};\n',
    });
    const session = await sessionFor(sandbox.path, 0);
    const initial = await executeRun(session, { stage: 'commit', skips: [], fix: false, isDryRun: false });
    expect(initial.report.exitCode).toBe(0);
    const directory = join(sandbox.path, '.gspot/cache');
    const [entry] = fs.readdirSync(directory);
    if (entry === undefined) throw new Error('The executed check did not create its cache result.');
    const path = join(directory, entry);
    const mode = fs.statSync(path).mode & 0o777;
    fs.chmodSync(path, 0);
    try {
        throws(() => readCached(sandbox.path, entry.slice(0, -5)), /Could not read cached check result.*EACCES/u);
    } finally {
        fs.chmodSync(path, mode);
    }
});

test('checks share generated-file hashes within a run and observe edits in the next run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        '.gspot/shared.toml': 'value = 1\n',
        'source.ts': 'export {};\n',
    });
    const session = await sessionFor(sandbox.path, 0);
    const manifest = session.scopes[0]!.selected[0]!;
    manifest.checks.push({ ...manifest.checks[0]!, name: 'sandbox/second' });
    const target = join(sandbox.path, '.gspot/shared.toml');
    const hash = cache.fileHash;
    let reads = 0;
    const observation = spyOn(cache, 'fileHash').mockImplementation((root, path) => {
        if (path === '.gspot/shared.toml') reads += 1;
        return hash(root, path);
    });
    const options = { stage: 'commit' as const, skips: [], fix: false, isDryRun: false };
    try {
        const first = await executeRun(session, options);
        expect(first.report.checks.map((check) => check.status)).toStrictEqual(['ok', 'ok']);
        expect(reads).toBe(1);
        const unchanged = await executeRun(session, options);
        expect(unchanged.report.checks.map((check) => check.status)).toStrictEqual(['cache', 'cache']);
        fs.writeFileSync(target, 'value = 2\n');
        const changed = await executeRun(session, options);
        expect(changed.report.checks.map((check) => check.status)).toStrictEqual(['ok', 'ok']);
        expect(reads).toBe(3);
    } finally {
        observation.mockRestore();
    }
});

test('a dry run does not create cache, report, or ownership files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'source.ts': 'export {};\n',
    });
    const before = fs.readdirSync(sandbox.path, { recursive: true });
    const outcome = await executeRun(await sessionFor(sandbox.path, 0), {
        stage: 'commit', skips: [], fix: false, isDryRun: true,
    });
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]?.status).toBe('ok');
    expect(fs.readdirSync(sandbox.path, { recursive: true })).toStrictEqual(before);
    expect(fs.readFileSync(join(sandbox.path, 'source.ts'), 'utf8')).toBe('export {};\n');
});

test('staged caches persist while index content, declared input additions, and corrections invalidate results', async () => {
    await using sandbox = await testdir();
    const policy = `version = 1
configurations = []
[[check]]
name = "sandbox/content"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = (await Bun.file("source.txt").text()).startsWith("clean") ? 0 : 1'])}
paths = ["source.txt"]
inputs = ["source.txt", "inputs/**"]
stage = "commit"
[check.output]
format = "none"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        '.gitignore': '.gspot/\n',
        'source.txt': 'clean baseline\n',
    });
    commitAll(sandbox.path);
    fs.writeFileSync(join(sandbox.path, 'source.txt'), 'clean staged\n');
    expect(git(sandbox.path, ['add', 'source.txt']).code).toBe(0);
    const command = ['check', '--staged', '--json'];
    const first = await run(sandbox.path, command);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(first.stdout)).checks[0]?.status).toBe('ok');
    fs.writeFileSync(join(sandbox.path, 'source.txt'), 'broken unstaged\n');
    const reused = await run(sandbox.path, command);
    expect(reused.code, reused.stdout + reused.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(reused.stdout)).checks[0]?.status).toBe('cache');
    expect(fs.readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('broken unstaged\n');
    expect(git(sandbox.path, ['add', 'source.txt']).code).toBe(0);
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(reportSchema.parse(JSON.parse(broken.stdout)).checks[0]?.status).toBe('fail');
    fs.writeFileSync(join(sandbox.path, 'source.txt'), 'clean staged\n');
    await createFileTree(sandbox.path, { 'inputs/added.txt': 'Declared input\n' });
    expect(git(sandbox.path, ['add', 'source.txt', 'inputs/added.txt']).code).toBe(0);
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks[0]?.status).toBe('ok');
    const unchanged = await run(sandbox.path, command);
    expect(unchanged.code, unchanged.stdout + unchanged.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(unchanged.stdout)).checks[0]?.status).toBe('cache');
    expect(fs.readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
});

test.each([
    ['xcode/xcstrings', 'App/Localizable.xcstrings', '{"sourceLanguage":"en","strings":{}}\n'],
    ['xcode/asset-catalogs', 'App/Assets.xcassets/Logo.imageset/Contents.json', '{"images":[{"filename":"logo.png"}]}\n'],
] as const)('a failed resource read is an execution error for %s; malformed JSON remains a finding', async (check, path, content) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["xcode"]\n',
        [path]: content,
        'App/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], only: [check], fix: false, isDryRun: false, noCache: true };
    const target = join(sandbox.path, path);
    fs.rmSync(target);
    fs.mkdirSync(target);
    const unreadable = await executeRun(session, options);
    expect(unreadable.report.exitCode).toBe(2);
    expect(unreadable.report.checks).toMatchObject([{ check, status: 'error', findings: [] }]);
    expect(unreadable.report.checks[0]?.note).toContain('EISDIR');
    expect(fs.statSync(target).isDirectory()).toBe(true);
    fs.rmSync(target, { recursive: true });
    fs.writeFileSync(target, '{');
    const malformed = await executeRun(session, options);
    expect(malformed.report.exitCode).toBe(1);
    expect(malformed.report.checks[0]?.findings).toMatchObject([{ file: path, line: 1, rule: 'parse' }]);
    expect(fs.readFileSync(target, 'utf8')).toBe('{');
    fs.writeFileSync(target, content);
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe(content);
});

test('a denied asset existence observation is an execution error and a genuinely missing image is a finding', async () => {
    await using sandbox = await testdir();
    const catalog = 'App/Assets.xcassets/Logo.imageset/Contents.json';
    const image = 'App/Assets.xcassets/Logo.imageset/logo.png';
    const content = '{"images":[{"filename":"logo.png"}]}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["xcode"]\n',
        [catalog]: content,
        [image]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'commit' as const, skips: [], only: ['xcode/asset-catalogs'], fix: false, isDryRun: false, noCache: true };
    const target = join(sandbox.path, image);
    const original = fs.statSync;
    const observation = spyOn(fs, 'statSync').mockImplementation(((...args: Parameters<typeof fs.statSync>) => {
        if (args[0] === target) throw Object.assign(new Error(`EACCES: cannot inspect ${image}`), { code: 'EACCES' });
        return original(...args);
    }) as typeof fs.statSync);
    try {
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks[0]?.status).toBe('error');
        expect(failed.report.checks[0]?.note).toContain(`EACCES: cannot inspect ${image}`);
        expect(failed.report.checks[0]?.findings).toStrictEqual([]);
    } finally {
        observation.mockRestore();
    }
    fs.rmSync(target);
    const missing = await executeRun(session, options);
    expect(missing.report.exitCode).toBe(1);
    expect(missing.report.checks[0]?.findings).toMatchObject([{ file: catalog, line: 1, rule: 'missing-image' }]);
    fs.writeFileSync(target, new Uint8Array([0, 1, 2]));
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
    expect(fs.readFileSync(join(sandbox.path, catalog), 'utf8')).toBe(content);
    expect(fs.readFileSync(target)).toStrictEqual(Buffer.from([0, 1, 2]));
});
