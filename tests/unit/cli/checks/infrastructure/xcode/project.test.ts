import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { unlink, symlink, writeFile } from 'node:fs/promises';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { GROUPED_PBXPROJ, SINGLE_FILE_PBXPROJ, INVALID_TEST_PLAN_DOCUMENTS } from '#tests/config/xcode.ts';

{
    const project = (name: string) => SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', `path = ${name}.swift;`);

    test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode'], { level: 'all' }),
            'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ,
            'First Group/Shared.swift': 'let first = 1\n',
            'Second/Shared.swift': 'let second = 2\n',
            'Root.swift': 'let root = 1\n',
            'Synced/Included.swift': 'let included = 1\n',
            'Synced/Excluded.swift': 'let excluded = 1\n',
        });
        const command = ['check', '--only', 'xcode/files-without-target', '--json'];
        const broken = await checkReport(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks[0]!.findings).toStrictEqual([
            containing({ file: 'Second/Shared.swift', rule: 'untargeted' }),
            containing({ file: 'Synced/Excluded.swift', rule: 'untargeted' }),
        ]);
        const included = GROUPED_PBXPROJ.replace('files = (B1, B2,);', 'files = (B1, B2, B3,);')
            .replace('B1 = {', 'B3 = {isa = PBXBuildFile; fileRef = F2; };\nB1 = {')
            .replace('membershipExceptions = (Excluded.swift,);', 'membershipExceptions = ();');
        await Bun.write(`${sandbox.path}/App.xcodeproj/project.pbxproj`, included);
        await Bun.file(`${sandbox.path}/Second/Shared.swift`).delete();
        const missing = await checkReport(sandbox.path, command);
        expect(missing.code, missing.stdout + missing.stderr).toBe(1);
        expect(missing.report.checks[0]!.findings).toStrictEqual([
            containing({
                file: 'App.xcodeproj/project.pbxproj',
                rule: 'missing-file',
                message: textContaining('Second/Shared.swift'),
            }),
        ]);
    });

    test('membership combines projects in a scope and checks nested scopes independently', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode'], { tables: '[[scope]]\npath = "nested"\n' }),
            'One.xcodeproj/project.pbxproj': project('One'),
            'Two.xcodeproj/project.pbxproj': project('Two'),
            'One.swift': 'let one = 1\n',
            'Two.swift': 'let two = 2\n',
            'nested/App.xcodeproj/project.pbxproj': project('Nested'),
            'nested/Nested.swift': 'let nested = 1\n',
            'nested/Extra.swift': 'let verbatim = 1\n',
        });
        const command = ['check', '--only', 'xcode/files-without-target', '--json'];
        const broken = await checkReport(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(
            broken.report.checks.map((check) => ({
                scope: check.scope,
                findings: check.findings,
            })),
        ).toStrictEqual([
            { scope: '', findings: [] },
            { scope: 'nested', findings: [containing({ file: 'nested/Extra.swift', rule: 'untargeted' })] },
        ]);
    });
}

test.each(INVALID_TEST_PLAN_DOCUMENTS)('%s reports malformed %s as a source finding', async (check, path, text) => {
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

// Windows file names cannot hold a newline or a quote.
test('a staged symbolic link is reported before the first commit and passes once it is a file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['xcode'], { level: 'all' }),
        'App.xcodeproj/project.pbxproj': '{}\n',
        'target.swift': 'let value = 1\n',
    });
    const path = 'link.swift';
    await symlink('target.swift', join(sandbox.path, path));
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    await unlink(join(sandbox.path, path));
    await symlink('working-tree.swift', join(sandbox.path, path));
    const session = await openSession(sandbox.path);

    expect(await checkFindings(session.root, 'xcode/symlinks')).toStrictEqual([
        containing({ check: 'xcode/symlinks', file: path, line: 1, rule: 'symlink', fixable: false }),
    ]);
    await unlink(join(sandbox.path, path));
    await writeFile(join(sandbox.path, path), 'let value = 1\n');
    gitOutput(sandbox.path, ['update-index', '--force-remove', '--', path]);
    gitOutput(sandbox.path, ['add', '--', path]);

    expect(await checkFindings(sandbox.path, 'xcode/symlinks')).toStrictEqual([]);
});
