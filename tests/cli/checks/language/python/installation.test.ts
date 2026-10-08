import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { environmentBin } from '#cli/platform/paths.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { toolPin, pythonPins } from '#cli/configurations/pins.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { importLinter } from '#cli/checks/language/python/imports/linter.ts';

test.each(LOCKFILES.filter(({ client }) => ['uv', 'poetry', 'pdm'].includes(client)))(
    'Python dependency ownership with $file applies only to locked scopes and accepts removal of the duplicate list',
    async ({ file }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['python'], {
                tables: '[scope."locked"]\nconfigurations = ["python"]\n[scope."other"]\nconfigurations = ["python"]\n',
                level: 'all',
            }),
            'requirements.txt': 'root-dependency\n',
            [`locked/${file}`]: 'version = 1\n',
            'locked/requirements.txt': 'duplicated-dependency\n',
            'locked/main.py': 'value = 1\n',
            'other/requirements.txt': 'unlocked-dependency\n',
            'other/main.py': 'value = 2\n',
        });
        const command = ['check', '--only', 'python/pip-installs', '--json'];
        const checked = await runGspot(sandbox.path, command);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            { file: 'locked/requirements.txt', rule: 'requirements-file' },
        ]);
        expect(report.checks.filter((check) => check.status === 'failed').map((check) => check.scope)).toStrictEqual([
            'locked',
        ]);
        await rm(join(sandbox.path, 'locked/requirements.txt'));
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);

test('absent Python import contracts are explicit skips and malformed project files are errors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        'main.py': 'value = 1\n',
        'pyproject.toml': '# [tool.importlinter] is only a comment\n',
    });
    const command = ['check', '--only', 'python/import-linter', '--json'];
    const absent = await runGspot(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    const report = JSON.parse(absent.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'python/import-linter', status: 'skipped' }]);
    expect(report.checks[0]!.note).toEqual(textContaining('import-linter'));
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[broken');
    const malformed = await runGspot(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/import-linter', status: 'error' },
    ]);
});

test.each(['stdout', 'stderr'])(
    'import-linter execution failure retains %s diagnostics and source bytes',
    async (stream) => {
        await using sandbox = await testdir();
        const manifest = '[tool.importlinter]\nroot_package = "example"\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['python']),
            'pyproject.toml': manifest,
            'example/__init__.py': '',
            [join(environmentBin('.gspot/.venv'), 'lint-imports')]: 'fixture',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        resources.use(
            mockPinnedExecutables([
                toolPin(session.manifests.values(), 'uv'),
                toolPin(session.manifests.values(), 'lint-imports'),
            ]),
        );
        const diagnostic = 'Could not load the import graph.';
        resources.use(
            spyOn(processes, 'run').mockResolvedValue({
                code: 2,
                stdout: stream === 'stdout' ? diagnostic : '',
                stderr: stream === 'stderr' ? diagnostic : '',
                missing: false,
                duration: 1,
            }),
        );
        expect(await rejection(importLinter(buildCheckInput(session, 'python/import-linter')))).toBe(
            `The lint-imports command failed: ${diagnostic}`,
        );
        expect(await Bun.file(join(sandbox.path, 'pyproject.toml')).text()).toBe(manifest);
    },
);

test('import-linter follows INI precedence and retains separate chains for decorated broken statuses', async () => {
    await using sandbox = await testdir();
    const config = '[importlinter]\nroot_package = example\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        'setup.cfg': config,
        '.importlinter': config,
        'pyproject.toml': '[tool.importlinter]\nroot_package = "example"\n',
        'example/__init__.py': '',
        [join(environmentBin('.gspot/.venv'), 'lint-imports')]: 'fixture',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(
        mockPinnedExecutables([
            toolPin(session.manifests.values(), 'uv'),
            toolPin(session.manifests.values(), 'lint-imports'),
        ]),
    );
    const command = resources.use(
        spyOn(processes, 'run').mockResolvedValue({
            code: 1,
            stdout: 'First boundary BROKEN (1 ignored import)\nSecond boundary BROKEN [0.1s]\n\n\u001B[1mBroken contracts\u001B[0m\n----------------\n\u001B[1mFirst boundary\u001B[0m\n--------------\nexample.low -> example.high (l. 1)\n\nSecond boundary\n---------------\nexample.other -> example.high (l. 3)\n',
            stderr: '',
            missing: false,
            duration: 1,
        }),
    );
    const findings = await importLinter(buildCheckInput(session, 'python/import-linter'));
    expect(findings.map((finding) => [finding.file, finding.rule])).toStrictEqual([
        ['setup.cfg', 'contract'],
        ['setup.cfg', 'contract'],
    ]);
    expect(findings[0]?.message).toContain('example.low -> example.high (l. 1)');
    expect(findings[0]?.message).not.toContain('example.other');
    expect(findings[1]?.message).toContain('example.other -> example.high (l. 3)');
    expect(command.mock.calls.flatMap(([argv]) => argv.slice(1))).toStrictEqual([
        'run',
        '--no-sync',
        '--project',
        session.root,
        '--with',
        ...pythonPins([...session.manifests.values()]).filter((pin) => pin.startsWith('import-linter==')),
        'lint-imports',
        '--config',
        'setup.cfg',
        '--no-cache',
    ]);
    expect(command.mock.calls.map(([, options]) => options.env?.['PYTHONDONTWRITEBYTECODE'])).toStrictEqual(['1']);
    expect(await Bun.file(join(sandbox.path, 'setup.cfg')).text()).toBe(config);
});

test('deptry skips a standalone script without a project and rejects malformed project metadata', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        'main.py': 'value = 1\n',
    });
    const command = ['check', '--only', 'python/deptry', '--json'];
    const absent = await runGspot(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    expect((JSON.parse(absent.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/deptry', status: 'skipped', note: 'This scope has no pyproject.toml for deptry to read.' },
    ]);
    await writeFile(join(sandbox.path, 'pyproject.toml'), '[broken');
    const malformed = await runGspot(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/deptry', status: 'error' },
    ]);
});

test('Python install path ignores accept only the selected script and keep unmanaged dependencies visible', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python', 'bash'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "python/pip-installs"\npaths = ["approved.sh"]\nreason = "This image builds the reviewed external dependency."\n',
        }),
        'uv.lock': 'version = 1\n',
        'main.py': 'value = 1\n',
        'approved.sh': 'pip install approved-module\n',
        'unmanaged.sh': 'pip install unmanaged-module\n',
        'requirements.txt': 'unmanaged-module\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'python/pip-installs', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'requirements.txt', rule: 'requirements-file' },
        { file: 'unmanaged.sh', rule: 'pip-install' },
    ]);
    expect(await readFile(join(sandbox.path, 'approved.sh'), 'utf8')).toBe('pip install approved-module\n');
});
