import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

test.each([
    ['xcode/xcstrings', 'App/Localizable.xcstrings', '{"sourceLanguage":"en","strings":{}}\n'],
    ['xcode/assets', 'App/Assets.xcassets/Logo.imageset/Contents.json', '{"images":[{"filename":"logo.png"}]}\n'],
] as const)(
    'a failed resource read is an execution error for %s; malformed JSON remains a finding',
    async (check, path, content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['xcode']),
            [path]: content,
            'App/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image("Logo")\n',
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ stage: 'commit', only: [check] });
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
        expect(malformed.report.checks[0]?.findings).toMatchObject([{ file: path, line: 1, rule: 'syntax' }]);
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
        'gspot.toml': buildPolicy(['xcode']),
        [assetManifest]: content,
        [image]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'commit', only: ['xcode/assets'] });
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

test.each(['logo-mark', 'logo_mark', 'Logo Mark'])(
    'Xcode asset %s accepts its camel-case symbol and reports an unrelated symbol',
    async (name) => {
        await using sandbox = await testdir();
        const path = `App/Assets.xcassets/${name}.imageset/Contents.json`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['xcode'], { level: 'all' }),
            [path]: '{"images":[{"filename":"logo.png"}]}\n',
            [`App/Assets.xcassets/${name}.imageset/logo.png`]: new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image(.logoMark)\n',
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ stage: 'commit', only: ['xcode/assets'] });
        const referenced = await executeRun(session, options);
        expect(referenced.report.exitCode).toBe(0);
        expect(referenced.report.checks[0]?.findings).toStrictEqual([]);
        fs.writeFileSync(join(sandbox.path, 'App/Home.swift'), 'let logo = Image(.differentLogo)\n');
        const orphan = await executeRun(session, options);
        expect(orphan.report.exitCode).toBe(1);
        expect(orphan.report.checks[0]?.findings).toMatchObject([
            { file: path, rule: 'orphan-asset', message: `No source names the asset ${name}.` },
        ]);
        expect(orphan.report.checks[0]?.findings).toHaveLength(1);
    },
);
