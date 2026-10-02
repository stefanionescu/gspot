import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import type { Stage } from '#cli/types/execution/planning.ts';

async function storageSession(root: string, status: number, stage: Stage = 'commit'): Promise<Session> {
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
                    runs: 'scope',
                    summary: 'Reports the planted storage finding.',
                    why: 'Storage failures preserve the check result.',
                    help: 'Fix the planted finding.',
                    files: manifest.files,
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

test.each([
    ['xcode/xcstrings', 'App/Localizable.xcstrings', '{"sourceLanguage":"en","strings":{}}\n'],
    ['xcode/assets', 'App/Assets.xcassets/Logo.imageset/Contents.json', '{"images":[{"filename":"logo.png"}]}\n'],
] as const)(
    'a failed resource read is an execution error for %s; malformed JSON remains a finding',
    async (check, path, content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['xcode']),
            [path]: content,
            'App/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image("Logo")\n',
        });
        const session = await openSession(sandbox.path);
        const options = runOptions({ stage: 'commit', only: [check] });
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
    },
);

test('a denied asset existence read is an execution error and a genuinely missing image is a finding', async () => {
    await using sandbox = await testdir();
    const assetManifest = 'App/Assets.xcassets/Logo.imageset/Contents.json';
    const image = 'App/Assets.xcassets/Logo.imageset/logo.png';
    const content = '{"images":[{"filename":"logo.png"}]}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xcode']),
        [assetManifest]: content,
        [image]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    const session = await openSession(sandbox.path);
    const options = runOptions({ stage: 'commit', only: ['xcode/assets'] });
    const target = join(sandbox.path, image);
    const original = fs.statSync;
    const read = spyOn(fs, 'statSync').mockImplementation(((...args: Parameters<typeof fs.statSync>) => {
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
        read.mockRestore();
    }
    fs.rmSync(target);
    const missing = await executeRun(session, options);
    expect(missing.report.exitCode).toBe(1);
    expect(missing.report.checks[0]?.findings).toMatchObject([{ file: assetManifest, line: 1, rule: 'missing-image' }]);
    fs.writeFileSync(target, new Uint8Array([0, 1, 2]));
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
    expect(fs.readFileSync(join(sandbox.path, assetManifest), 'utf8')).toBe(content);
    expect(fs.readFileSync(target)).toStrictEqual(Buffer.from([0, 1, 2]));
});

test('a dry run creates no files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([]),
        'source.ts': 'export {};\n',
    });
    const before = fs.readdirSync(sandbox.path, { recursive: true });
    const outcome = await executeRun(
        await storageSession(sandbox.path, 0),
        runOptions({ stage: 'commit', isDryRun: true }),
    );
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]!.status).toBe('ok');
    expect(fs.readdirSync(sandbox.path, { recursive: true })).toStrictEqual(before);
    expect(fs.readFileSync(join(sandbox.path, 'source.ts'), 'utf8')).toBe('export {};\n');
});
