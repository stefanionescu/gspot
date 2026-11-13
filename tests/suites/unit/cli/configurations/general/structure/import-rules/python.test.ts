import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('structure/import-rules reports a Python file outside every rule and each refused import, a relative one too', async () => {
    await using sandbox = await createGitSandbox({
        'src/app/__init__.py': '',
        'src/app/core/__init__.py': '',
        'src/app/core/model.py': 'VALUE = 1\n',
        'src/app/core/uses_web.py': 'from app.web import views\n',
        'src/app/storage/__init__.py': '',
        'src/app/storage/db.py': 'from app.core.model import VALUE\n',
        'src/app/web/views.py':
            'import folder_paths\nfrom app.core import model\nfrom app.storage.db import VALUE\nfrom ..core.model import VALUE as AGAIN\nimport requests\n',
        'tests/test_views.py': 'from app.web import views\n',
        'setup.py': '',
        'gspot.toml': buildSandboxSettings(['python'], {
            tables: `[python]
externals = { value = ["folder_paths"], reason = "The host application supplies this module at runtime." }

[[import_rule]]
name = "core"
paths = ["src/app/core/**"]

[[import_rule]]
name = "storage"
paths = ["src/app/storage/**"]

[[import_rule]]
name = "web"
paths = ["src/app/web/**"]
can_import = ["storage"]
`,
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/import-rules');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'src/app/__init__.py',
            line: 1,
            rule: 'uncovered-file',
            message: expect.any(String) as string,
        },
        {
            file: 'src/app/core/uses_web.py',
            line: 1,
            rule: 'refused-import',
            message: expect.stringMatching(/\bcore\b.+\bapp\.web\.views\b/u) as string,
        },
        {
            file: 'src/app/web/views.py',
            line: 2,
            rule: 'refused-import',
            message: expect.stringMatching(/\bweb\b.+\bapp\.core\.model\b/u) as string,
        },
        {
            file: 'src/app/web/views.py',
            line: 4,
            rule: 'refused-import',
            message: expect.stringMatching(/\bweb\b.*\.\.core\.model\b/u) as string,
        },
    ]);
});

test('without import rules the check is skipped', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'main.py': 'import os\n',
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/import-rules'] }),
    );
    expect(report.checks).toMatchObject([
        { check: 'structure/import-rules', status: 'skipped', note: expect.stringContaining('import_rule') as string },
    ]);
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

test('import_folders lets an import rule read a module under that folder', async () => {
    const rules =
        '[[import_rule]]\nname = "app"\npaths = ["app/**"]\ncan_import = []\n[[import_rule]]\nname = "host"\npaths = ["vendor/host/**"]\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { tables: rules }),
        'app/main.py': 'from hostlib import VALUE\n',
        'vendor/host/hostlib.py': 'VALUE = 1\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/import-rules')).toStrictEqual([]);
    const listed = `${rules}[python]\nimport_folders = ["vendor/host"]\n`;
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['python'], { tables: listed }));
    expect(await runSandboxCheck(sandbox.path, 'structure/import-rules')).toMatchObject([
        { file: 'app/main.py', line: 1, rule: 'refused-import' },
    ]);
});
