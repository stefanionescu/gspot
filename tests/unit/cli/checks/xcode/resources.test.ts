import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { ASSET_SETTING_CASES, UNREADABLE_RESOURCES, INVALID_RESOURCE_DOCUMENTS } from '#tests/data/checks/xcode.ts';

test.each([...UNREADABLE_RESOURCES])(
    'a failed resource read is an execution error for %s, and malformed JSON is a finding',
    async (check, path, content) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['xcode']),
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
        const unreadable = await runChecks(session, options);

        expect(unreadable.report.checks).toMatchObject([{ check, status: 'error', findings: [] }]);
        expect(unreadable.report.checks[0]?.note).toContain(
            `${path} could not be read. Check the file and its permissions.`,
        );
        const folder = files.readStats(path)!;
        expect(folder.isDirectory()).toBe(true);
        await rm(target, { recursive: true });
        files.write(path, { bytes: Buffer.from('{'), mode }, undefined);
        const malformed = await runChecks(await openSession(session.root), options);

        expect(malformed.report.checks[0]?.findings).toMatchObject([{ file: path, line: 1, rule: 'syntax' }]);
    },
);

test('xcode/assets reports an image that the set names and the repository does not hold', async () => {
    const contentsPath = 'App/Assets.xcassets/Logo.imageset/Contents.json';
    const image = 'App/Assets.xcassets/Logo.imageset/logo.png';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode']),
        [contentsPath]: '{"images":[{"filename":"logo.png"}]}\n',
        [image]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    commitAll(sandbox.path);
    await rm(join(sandbox.path, image));
    const findings = await checkFindings(sandbox.path, 'xcode/assets');
    expect(findings).toMatchObject([
        { file: contentsPath, line: 1, rule: 'missing-image', message: 'The image logo.png is not in the set.' },
    ]);
});

test('xcode/assets reports an ignored image that is on disk but not in the repository', async () => {
    const contentsPath = 'App/Assets.xcassets/Logo.imageset/Contents.json';
    const image = 'App/Assets.xcassets/Logo.imageset/logo.png';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode']),
        '.gitignore': `${image}\n`,
        [contentsPath]: '{"images":[{"filename":"logo.png"}]}\n',
        [image]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    });
    commitAll(sandbox.path);
    expect(readGitOutput(sandbox.path, ['check-ignore', image])).toBe(image);
    expect(await readFile(join(sandbox.path, image))).toStrictEqual(Buffer.from([0, 1, 2]));
    const findings = await checkFindings(sandbox.path, 'xcode/assets');
    expect(findings).toMatchObject([
        { file: contentsPath, line: 1, rule: 'missing-image', message: 'The image logo.png is not in the set.' },
    ]);

    await writeFile(join(sandbox.path, '.gitignore'), '');
    expect(await checkFindings(sandbox.path, 'xcode/assets')).toStrictEqual([]);
});

test.each(['logo-mark', 'logo_mark', 'Logo Mark', 'Logo MarkImage', 'logo-markColor'])(
    'Xcode asset %s accepts its camel-case symbol and reports an unrelated symbol',
    async (name) => {
        await using sandbox = await testdir();
        const path = `App/Assets.xcassets/${name}.imageset/Contents.json`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['xcode'], { level: 'all' }),
            [path]: '{"images":[{"filename":"logo.png"}]}\n',
            [`App/Assets.xcassets/${name}.imageset/logo.png`]: new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image(.logoMark)\n',
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ stage: 'commit', only: ['xcode/unused-assets'] });
        const referenced = await runChecks(session, options);

        expect(referenced.report.checks[0]?.findings).toStrictEqual([]);
        await writeFile(join(sandbox.path, 'App/Home.swift'), 'let logo = Image(.differentLogo)\n');
        const orphan = await runChecks(await openSession(session.root), options);

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
            'gspot.toml': buildSandboxSettings(['xcode'], {
                level: 'all',
                tables: scope === '' ? '' : '[[scope]]\npath = "app"\n',
            }),
            [asset]: '{}\n',
            [path]: text,
        });
        const options = buildRunOptions({ stage: 'commit', only: ['xcode/unused-assets'] });
        const referenced = await runChecks(await openSession(sandbox.path), options);

        expect(referenced.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        await writeFile(join(sandbox.path, path), text.replaceAll('AccentColor', 'DifferentAccentColor'));
        const orphan = await runChecks(await openSession(sandbox.path), options);

        expect(orphan.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { check: 'xcode/unused-assets', file: asset, line: 1, rule: 'unused-asset' },
        ]);
    },
);

test.each(INVALID_RESOURCE_DOCUMENTS)('%s reports malformed %s as a source finding', async (check, path, text) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode'], { level: 'all' }),
        'Source.swift': 'let image = Image("Logo")\n',
        [path]: text,
    });

    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: [check] }));

    const report = result.report;
    expect(report.checks.map(({ status }) => status)).toStrictEqual(['failed']);
    expect(
        report.checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([{ file: path, line: 1, rule: 'syntax' }]);
});
