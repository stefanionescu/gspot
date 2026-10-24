import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

import {
    LOGO_IMAGE_SET,
    ASSET_SETTING_CASES,
    UNREADABLE_RESOURCES,
    PARTLY_TRANSLATED_STRINGS,
    INVALID_RESOURCE_DOCUMENTS,
} from '#tests/config/checks/infrastructure/xcode.ts';

test.each([...UNREADABLE_RESOURCES])(
    '$check errors on a resource file it cannot read',
    async ({ check, path, text }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['xcode']),
            [path]: text,
            'App/Assets.xcassets/Logo.imageset/logo.png': new Uint8Array([0, 1, 2]),
            'App/Home.swift': 'let logo = Image("Logo")\n',
        });

        const session = await openSession(sandbox.path);
        const planned = planSandboxCheck(session, check);
        const target = join(sandbox.path, path);
        await rm(target);
        await mkdir(target);
        session.reads.sources.delete(path);
        const error = await captureRejection(findBuiltInCheck(check)(session, planned));
        expect(error.message).toBe(`${path} could not be read. Check the file and its permissions.`);
    },
);

test('xcode/assets reports an image that the set names and the repository does not hold', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['xcode']), ...LOGO_IMAGE_SET.files });
    commitAll(sandbox.path);
    await rm(join(sandbox.path, LOGO_IMAGE_SET.image));
    expect(await runSandboxCheck(sandbox.path, 'xcode/assets')).toMatchObject([LOGO_IMAGE_SET.missingFinding]);
});

test('xcode/assets reports an ignored image that is on disk but not in the repository', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode']),
        '.gitignore': `${LOGO_IMAGE_SET.image}\n`,
        ...LOGO_IMAGE_SET.files,
    });
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'xcode/assets')).toMatchObject([LOGO_IMAGE_SET.missingFinding]);

    await writeFile(join(sandbox.path, '.gitignore'), '');
    expect(await runSandboxCheck(sandbox.path, 'xcode/assets')).toStrictEqual([]);
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
                scopes: scope === '' ? [] : [{ path: 'app' }],
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

test.each([...INVALID_RESOURCE_DOCUMENTS])(
    '$check reports malformed $path as a source finding',
    async ({ check, path, text }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['xcode'], { level: 'all' }),
            'Source.swift': 'let image = Image("Logo")\n',
            [path]: text,
        });

        const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: [check] }));
        expect(report.checks.map(({ status }) => status)).toStrictEqual(['failed']);
        expect(listFindingRows(report)).toStrictEqual([{ file: path, line: 1, rule: 'syntax' }]);
    },
);

test('xcode/assets reports an image set that names no image file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode']),
        [LOGO_IMAGE_SET.contents]: '{"images":[{"idiom":"universal"}]}\n',
        'App/Home.swift': LOGO_IMAGE_SET.files['App/Home.swift'],
    });
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'xcode/assets')).toStrictEqual([
        matchFields({
            file: LOGO_IMAGE_SET.contents,
            line: 1,
            rule: 'empty-set',
            message: 'This image set names no image file.',
        }),
    ]);
});

test('xcode/xcstrings reports a string without a translation for a locale the catalog uses', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode']),
        'App/Localizable.xcstrings': JSON.stringify(PARTLY_TRANSLATED_STRINGS),
    });
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'xcode/xcstrings')).toStrictEqual([
        matchFields({
            file: 'App/Localizable.xcstrings',
            line: 1,
            rule: 'missing-translation',
            message: '"Goodbye" has no translation for fr.',
        }),
    ]);
});
