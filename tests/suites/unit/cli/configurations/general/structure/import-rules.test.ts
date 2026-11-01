import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { OS_SOURCE } from '#tests/config/configurations/python.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GROUPED_PBXPROJ } from '#tests/config/setup/configurations.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { NAMED_TARGET_SOURCE, EMPTY_DEFAULT_SOURCE, NATIVE_TARGET_SOURCE } from '#tests/config/setup/languages.ts';

import {
    REFUSAL_HELP,
    SWIFT_IMPORT_FILES,
    SWIFT_IMPORT_RULES,
    PYTHON_IMPORT_FILES,
    PYTHON_IMPORT_RULES,
    UNCOVERED_FILE_MESSAGE,
} from '#tests/config/configurations/structure/files.ts';

test('structure/import-rules reports a Python file outside every rule and each refused import, a relative one too', async () => {
    await using sandbox = await createGitSandbox({
        ...PYTHON_IMPORT_FILES,
        'gspot.toml': buildSandboxSettings(['python'], { tables: PYTHON_IMPORT_RULES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
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
            message: `Import rule "core" may import only its own files, not app.web.views from import-rule:web. ${REFUSAL_HELP}`,
        },
        {
            file: 'src/app/web/views.py',
            line: 2,
            rule: 'refused-import',
            message: `Import rule "web" may import its own files and "storage", not app.core.model from import-rule:core. ${REFUSAL_HELP}`,
        },
        {
            file: 'src/app/web/views.py',
            line: 4,
            rule: 'refused-import',
            message: `Import rule "web" may import its own files and "storage", not ..core.model from import-rule:core. ${REFUSAL_HELP}`,
        },
    ]);
});

test('Swift imports follow the import rules through the SwiftPM targets, and a file outside every rule is reported', async () => {
    await using sandbox = await createGitSandbox({
        ...SWIFT_IMPORT_FILES,
        'gspot.toml': buildSandboxSettings(['swift'], { tables: SWIFT_IMPORT_RULES }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'Sources/Loose/Helper.swift',
            line: 1,
            rule: 'uncovered-file',
            message: UNCOVERED_FILE_MESSAGE,
        },
        {
            file: 'Sources/Core/Model.swift',
            line: 2,
            rule: 'refused-import',
            message: `Import rule "core" may import only its own files, not Feature from import-rule:feature. ${REFUSAL_HELP}`,
        },
    ]);
});

test('an Xcode native target is a Swift module named after the target', async () => {
    await using sandbox = await createGitSandbox({
        'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ.replace(NATIVE_TARGET_SOURCE, NAMED_TARGET_SOURCE),
        'First Group/Shared.swift': 'public struct Shared {}\n',
        'Root.swift': 'public struct Root {}\n',
        'Tools/Script.swift': 'import App_Kit\n',
        'gspot.toml': buildSandboxSettings(['swift'], {
            tables: '[[import_rule]]\nname = "tools"\npaths = ["Tools/**"]\n\n[[import_rule]]\nname = "app"\npaths = ["First Group/**", "Root.swift"]\n',
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Tools/Script.swift', line: 1, rule: 'refused-import' },
    ]);
});

test('without import rules the check is skipped', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'main.py': OS_SOURCE,
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/import-rules'] }),
    );
    expect(report.checks).toMatchObject([
        { check: 'structure/import-rules', status: 'skipped', note: 'needs the setting import_rule' },
    ]);
});

test('import rules exempt a local ESLint plugin named by settings', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[[import_rule]]\nname = "source"\npaths = ["src/**"]\n[[tools.eslint.plugins]]\nname = "local"\npath = "tools/lint/plugin.mjs"\nrules = {}\n',
        }),
        'src/index.js': 'export {};\n',
        'tools/lint/plugin.mjs': EMPTY_DEFAULT_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/import-rules')).toStrictEqual([]);
});

test('a vendored Python file under a rule reports nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            tables: '[[import_rule]]\nname = "vendor"\npaths = ["imported/**"]\n[[import_rule]]\nname = "app"\npaths = ["app/**"]\n',
        }),
        'imported/client.py': 'from app import model\n',
        'app/model.py': 'VALUE = 1\n',
        '.gitattributes': 'imported/** linguist-vendored\n',
    });
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'structure/import-rules')).toStrictEqual([]);
    await writeFile(join(sandbox.path, '.gitattributes'), '');
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'imported/client.py', rule: 'refused-import' },
    ]);
});
