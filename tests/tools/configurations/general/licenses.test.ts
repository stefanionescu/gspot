// The native scanner accepts allowed license alternatives and reports a disallowed dependency.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { buildSandboxPath, installToolProjects } from '#tests/harness/install.ts';
import { installGeneratedPythonTools } from '#tests/harness/python-installation.ts';
import { ROOT, LICENSE_CHECK } from '#tests/config/tools/configurations/general/licenses.ts';

test('native license scanning accepts allowed alternatives and rejects a disallowed dependency', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'package.json': ROOT,
        '.gitignore': 'node_modules/\n',
        'node_modules/kind/package.json': JSON.stringify({ name: 'kind', version: '1.0.0', license: 'MIT' }),
        'node_modules/choice/package.json': JSON.stringify({
            name: 'choice',
            version: '1.0.0',
            license: 'MIT OR (GPL-3.0-only AND GPL-2.0-only)',
        }),
        'node_modules/combined/package.json': JSON.stringify({
            name: 'combined',
            version: '1.0.0',
            license: 'MIT AND (Apache-2.0 OR GPL-3.0-only)',
        }),
    });
    commitAll(root);
    const environment = { PATH: buildSandboxPath(['typos', 'ec']) };
    for (const command of [buildInitArguments(['licenses']), ['set', 'licenses.allowed', '["MIT","Apache-2.0"]']]) {
        const prepared = await spawnGspot(root, command, environment);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    }
    await installToolProjects(root);
    const baseline = await spawnGspot(root, LICENSE_CHECK, environment);
    expect(baseline.code, baseline.stdout + baseline.stderr).toBe(0);
    expect((JSON.parse(baseline.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    await Bun.write(
        join(root, 'node_modules/strict/package.json'),
        JSON.stringify({ name: 'strict', version: '1.0.0', license: 'GPL-3.0-only' }),
    );
    const checked = await spawnGspot(root, LICENSE_CHECK, environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks[0]?.findings).toStrictEqual([
        containing({
            file: 'package.json',
            line: 1,
            rule: 'disallowed-license',
            message: textContaining('strict@1.0.0 reports GPL-3.0-only'),
        }),
    ]);
});

test('native Python license scanning ignores project scanner exclusions and matches an exception by its normalized name', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const files = {
        'gspot.toml': buildPolicy(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n', level: 'all' }),
        'pyproject.toml':
            '[project]\nname = "fixture"\nversion = "0.0.0"\n[tool.pip-licenses]\nignore-packages = ["licensed-example"]\n',
    };
    await createFileTree(root, files);
    const environment = await runTestCommand(['uv', 'venv', '.venv'], { cwd: root });
    expect(environment.code, environment.stdout + environment.stderr).toBe(0);
    const applied = await runGspot(root, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installGeneratedPythonTools(root);
    const location = await runTestCommand(
        [
            environmentExecutable(join(root, '.venv'), 'python'),
            '-I',
            '-c',
            'import sysconfig; print(sysconfig.get_path("purelib"))',
        ],
        { cwd: root },
    );
    expect(location.code, location.stderr).toBe(0);
    const metadata = join(location.stdout.trim(), 'licensed_example-1.0.0.dist-info/METADATA');
    await Bun.write(metadata, `Metadata-Version: 2.1\nName: licensed-example\nVersion: 1.0.0\nLicense: GPL-3.0-only\n`);
    expect(
        await BUILT_IN_CHECKS['licenses/packages'].input(buildCheckInput(await openSession(root), 'licenses/packages')),
    ).toStrictEqual([
        containing({
            file: 'pyproject.toml',
            rule: 'disallowed-license',
            message: textContaining('licensed-example@1.0.0 reports GPL-3.0-only'),
        }),
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        buildPolicy(['licenses'], {
            tables: '[licenses]\nallowed = ["MIT"]\n[licenses.exceptions]\n"Licensed._Example@1.0.0" = { license = "GPL-3.0-only", reason = "The sandbox tests exact reported license consent." }\n',
            level: 'all',
        }),
    );
    const corrected = await runGspot(root, ['apply', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        await BUILT_IN_CHECKS['licenses/packages'].input(buildCheckInput(await openSession(root), 'licenses/packages')),
    ).toStrictEqual([]);
});

test('native installed font metadata justifies its root exception in a descendant without a root manifest', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['licenses'], {
            tables: 'runner = "mise"\n[licenses]\nallowed = ["MIT"]\n[licenses.exceptions]\n"@fontsource/inter@5.2.8" = { license = "OFL-1.1", reason = "Documentation distributes the font." }\n[scope.docs]\n',
        }),
        'docs/package.json': '{"name":"docs","private":true,"dependencies":{"@fontsource/inter":"5.2.8"}}',
        'docs/node_modules/@fontsource/inter/package.json':
            '{"name":"@fontsource/inter","version":"5.2.8","license":"OFL-1.1"}',
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    expect(
        await BUILT_IN_CHECKS['licenses/packages'].input(buildCheckInput(session, 'licenses/packages')),
    ).toStrictEqual([]);
});
