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
    GROUPED_PBXPROJ,
    ASSET_SETTING_CASES,
    UNREADABLE_RESOURCES,
    PARTLY_TRANSLATED_STRINGS,
    ENTITLEMENT_SCOPE_RESULTS,
    INVALID_RESOURCE_DOCUMENTS,
} from '#tests/config/checks/infrastructure/xcode.ts';

test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode'], { level: 'all' }),
        'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ,
        'First Group/Shared.swift': 'let first = 1\n',
        'Second/Shared.swift': 'let second = 2\n',
        'Root.swift': 'let root = 1\n',
        'Synced/Included.swift': 'let included = 1\n',
        'Synced/Excluded.swift': 'let excluded = 1\n',
    });

    const broken = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['xcode/files-without-target'] }),
    );

    expect(broken.report.checks[0]!.findings).toStrictEqual([
        matchFields({ file: 'Second/Shared.swift', rule: 'untargeted' }),
        matchFields({ file: 'Synced/Excluded.swift', rule: 'untargeted' }),
    ]);
});

test('membership combines projects in a scope and checks nested scopes independently', async () => {
    const SINGLE_FILE_PBXPROJ = GROUPED_PBXPROJ.replace('files = (B1, B2,);', 'files = (B2,);').replace(
        'fileSystemSynchronizedGroups = (SYNC,);',
        '',
    );

    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode'], { scopes: [{ path: 'nested' }] }),
        'One.xcodeproj/project.pbxproj': SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', 'path = One.swift;'),
        'Two.xcodeproj/project.pbxproj': SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', 'path = Two.swift;'),
        'One.swift': 'let one = 1\n',
        'Two.swift': 'let two = 2\n',
        'nested/App.xcodeproj/project.pbxproj': SINGLE_FILE_PBXPROJ.replace(
            'path = Root.swift;',
            'path = Nested.swift;',
        ),
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let verbatim = 1\n',
    });

    const broken = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['xcode/files-without-target'] }),
    );

    expect(broken.report.checks.map(({ scope, findings }) => ({ scope, findings }))).toStrictEqual([
        { scope: '', findings: [] },
        { scope: 'nested', findings: [matchFields({ file: 'nested/Extra.swift', rule: 'untargeted' })] },
    ]);
});

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

test('xcode/entitlements checks the deepest scope only', async () => {
    const ENTITLEMENT_DOCUMENTS = {
        path: 'App.entitlements',
        unlisted: '<plist><dict><key>unlisted-capability</key><true/></dict></plist>',
        allowed: '<plist><dict><key>nested-capability</key><true/></dict></plist>',
    } as const;

    const { path, unlisted: broken, allowed: corrected } = ENTITLEMENT_DOCUMENTS;
    const check = 'xcode/entitlements';
    await using sandbox = await testdir();
    const rootContent = corrected.replace('nested-capability', 'root-capability');
    const settings = buildSandboxSettings(['xcode'], {
        tables: '[xcode]\nallowed_entitlements = ["root-capability"]\n[[scope]]\npath = "app"\n[scope.xcode]\nallowed_entitlements = ["nested-capability"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
        level: 'all',
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        [path]: rootContent,
        [`app/${path}`]: corrected,
        [`app/child/${path}`]: broken,
        [`sibling/${path}`]: rootContent,
    });
    const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: [check] }));
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([...ENTITLEMENT_SCOPE_RESULTS]);
    expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: `app/child/${path}`, line: 1, rule: 'entitlement' },
    ]);
});
