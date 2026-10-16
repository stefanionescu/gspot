import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { checkReport, buildRunOptions } from '#tests/setup/run-gspot.ts';
import { ASSET_SETTING_CASES, UNREADABLE_RESOURCES, INVALID_RESOURCE_DOCUMENTS } from '#tests/config/xcode.ts';

test.each([...UNREADABLE_RESOURCES])(
    'a failed resource read is an execution error for %s, and malformed JSON is a finding',
    async (check, path, content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode']),
            [path]: content,
            'App/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image("Logo")\n',
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ stage: 'commit', only: [check] });
        using files = openFiles(sandbox.path);
        const target = join(sandbox.path, path);
        const { mode } = files.read(path)!;
        await rm(target);
        await mkdir(target);
        const unreadable = await executeRun(session, options);
        expect(unreadable.report.exitCode).toBe(2);
        expect(unreadable.report.checks).toMatchObject([{ check, status: 'error', findings: [] }]);
        expect(unreadable.report.checks[0]?.note).toContain('EISDIR');
        const directory = files.stat(path)!;
        expect(directory.isDirectory()).toBe(true);
        await rm(target, { recursive: true });
        files.write(path, { bytes: Buffer.from('{'), mode }, undefined);
        const malformed = await executeRun(await openSession(session.root), options);
        expect(malformed.report.exitCode).toBe(1);
        expect(malformed.report.checks[0]?.findings).toMatchObject([{ file: path, line: 1, rule: 'syntax' }]);
    },
);

test('a denied asset existence read is an execution error and a genuinely missing image is a finding', async () => {
    await using sandbox = await testdir();
    const assetManifest = 'App/Assets.xcassets/Logo.imageset/Contents.json';
    const image = 'App/Assets.xcassets/Logo.imageset/logo.png';
    const content = '{"images":[{"filename":"logo.png"}]}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['xcode']),
        [assetManifest]: content,
        [image]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'commit', only: ['xcode/assets'] });
    const target = join(sandbox.path, image);
    const original = fs.statSync;
    {
        using resources = new DisposableStack();

        resources.use(
            spyOn(fs, 'statSync').mockImplementation(((...args: Parameters<typeof fs.statSync>) => {
                if (args[0] === target)
                    throw Object.assign(new Error(`EACCES: cannot inspect ${image}`), { code: 'EACCES' });
                return original(...args);
            }) as typeof fs.statSync),
        );

        const failed = await executeRun(session, options);
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks[0]?.status).toBe('error');
        expect(failed.report.checks[0]?.note).toContain(`EACCES: cannot inspect ${image}`);
        expect(failed.report.checks[0]?.findings).toStrictEqual([]);
    }
    await rm(target);
    const missing = await executeRun(await openSession(session.root), options);
    expect(missing.report.exitCode).toBe(1);
    expect(missing.report.checks[0]?.findings).toMatchObject([{ file: assetManifest, line: 1, rule: 'missing-image' }]);
});

test.each(['logo-mark', 'logo_mark', 'Logo Mark', 'Logo MarkImage', 'logo-markColor'])(
    'Xcode asset %s accepts its camel-case symbol and reports an unrelated symbol',
    async (name) => {
        await using sandbox = await testdir();
        const path = `App/Assets.xcassets/${name}.imageset/Contents.json`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode'], { level: 'all' }),
            [path]: '{"images":[{"filename":"logo.png"}]}\n',
            [`App/Assets.xcassets/${name}.imageset/logo.png`]: new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image(.logoMark)\n',
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ stage: 'commit', only: ['xcode/unused-assets'] });
        const referenced = await executeRun(session, options);
        expect(referenced.report.exitCode).toBe(0);
        expect(referenced.report.checks[0]?.findings).toStrictEqual([]);
        await writeFile(join(sandbox.path, 'App/Home.swift'), 'let logo = Image(.differentLogo)\n');
        const orphan = await executeRun(await openSession(session.root), options);
        expect(orphan.report.exitCode).toBe(1);
        expect(orphan.report.checks[0]?.findings).toMatchObject([
            { file: path, rule: 'unused-asset', message: `No source names the asset ${name}.` },
        ]);
    },
);

test.each([...ASSET_SETTING_CASES])(
    '$title counts the asset and rejects an unrelated name',
    async ({ scope, path, text }) => {
        await using sandbox = await testdir();
        const asset = `${scope}Assets.xcassets/AccentColor.colorset/Contents.json`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode'], {
                level: 'all',
                tables: scope === '' ? '' : '[[scope]]\npath = "app"\n',
            }),
            [asset]: '{}\n',
            [path]: text,
        });
        const options = buildRunOptions({ stage: 'commit', only: ['xcode/unused-assets'] });
        const referenced = await executeRun(await openSession(sandbox.path), options);
        expect(referenced.report.exitCode).toBe(0);
        expect(referenced.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        await writeFile(join(sandbox.path, path), text.replaceAll('AccentColor', 'DifferentAccentColor'));
        const orphan = await executeRun(await openSession(sandbox.path), options);
        expect(orphan.report.exitCode).toBe(1);
        expect(orphan.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { check: 'xcode/unused-assets', file: asset, line: 1, rule: 'unused-asset' },
        ]);
    },
);

test.each(INVALID_RESOURCE_DOCUMENTS)('%s reports malformed %s as a source finding', async (check, path, text) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['xcode'], { level: 'all' }),
        'Source.swift': 'let image = Image("Logo")\n',
        [path]: text,
    });
    const result = await checkReport(sandbox.path, ['check', '--only', check, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.map(({ status }) => status)).toStrictEqual(['failed']);
    expect(
        report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([{ file: path, line: 1, rule: 'syntax' }]);
});
