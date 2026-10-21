import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { GROUPED_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { UNCOVERED_FILE_MESSAGE } from '#cli/config/checks/import-rules.ts';

import {
    REFUSAL_HINT,
    SWIFT_IMPORT_FILES,
    SWIFT_IMPORT_RULES,
    PYTHON_IMPORT_FILES,
    PYTHON_IMPORT_RULES,
} from '#tests/data/checks/structure/import-rules.ts';

test('Python imports follow the import rules: rules above, can_import, relative imports, and host modules', async () => {
    await using sandbox = await testdir({
        ...PYTHON_IMPORT_FILES,
        'gspot.toml': buildSandboxSettings(['python'], { tables: PYTHON_IMPORT_RULES }),
    });
    const findings = await checkFindings(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'src/app/__init__.py',
            line: 1,
            rule: 'uncovered-file',
            message: UNCOVERED_FILE_MESSAGE,
        },
        {
            file: 'src/app/core/uses_web.py',
            line: 1,
            rule: 'refused-import',
            message: `Import rule "core" may import only its own files, not app.web.views from import-rule:web. ${REFUSAL_HINT}`,
        },
        {
            file: 'src/app/web/views.py',
            line: 2,
            rule: 'refused-import',
            message: `Import rule "web" may import its own files and "storage", not app.core.model from import-rule:core. ${REFUSAL_HINT}`,
        },
        {
            file: 'src/app/web/views.py',
            line: 4,
            rule: 'refused-import',
            message: `Import rule "web" may import its own files and "storage", not ..core.model from import-rule:core. ${REFUSAL_HINT}`,
        },
    ]);
});

test('Swift imports follow the import rules through the SwiftPM targets, and a file outside every rule is reported', async () => {
    await using sandbox = await testdir({
        ...SWIFT_IMPORT_FILES,
        'gspot.toml': buildSandboxSettings(['swift'], { tables: SWIFT_IMPORT_RULES }),
    });
    const findings = await checkFindings(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        { file: 'Sources/Loose/Helper.swift', line: 1, rule: 'uncovered-file', message: UNCOVERED_FILE_MESSAGE },
        {
            file: 'Sources/Core/Model.swift',
            line: 2,
            rule: 'refused-import',
            message: `Import rule "core" may import only its own files, not Feature from import-rule:feature. ${REFUSAL_HINT}`,
        },
    ]);
});

test('an Xcode native target is a Swift module named after the target', async () => {
    await using sandbox = await testdir({
        'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ.replace(
            'T = {isa = PBXNativeTarget;',
            'T = {isa = PBXNativeTarget; name = "App Kit";',
        ),
        'First Group/Shared.swift': 'public struct Shared {}\n',
        'Root.swift': 'public struct Root {}\n',
        'Tools/Script.swift': 'import App_Kit\n',
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[[import_rule]]\nname = "tools"\npaths = ["Tools/**"]\n\n[[import_rule]]\nname = "app"\npaths = ["First Group/**", "Root.swift"]\n',
        }),
    });
    const findings = await checkFindings(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Tools/Script.swift', line: 1, rule: 'refused-import' },
    ]);
});

test('without import rules the check is skipped', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {}),
        'main.py': 'import os\n',
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/import-rules'] }),
    );
    expect(report.checks).toMatchObject([
        { check: 'structure/import-rules', status: 'skipped', note: 'Add [[import_rule]] records to check imports.' },
    ]);
});
