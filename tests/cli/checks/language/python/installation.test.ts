import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { environmentBin } from '#cli/platform/paths.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { importLinter } from '#cli/checks/language/python/imports/linter.ts';

const { version: RUNNING_VERSION } = packageManifest;

test('Python dependency ownership applies only to locked scopes and accepts removal of the duplicate list', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], {
            tables: '[[scope]]\npath = "locked"\nconfigurations = ["python"]\n[[scope]]\npath = "other"\nconfigurations = ["python"]\n',
            level: 'all',
        }),
        '.gspot/version': `${RUNNING_VERSION}\n`,
        'requirements.txt': 'root-dependency\n',
        'locked/uv.lock': 'version = 1\n',
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
    rmSync(join(sandbox.path, 'locked/requirements.txt'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
});

test('absent Python import contracts are explicit skips and malformed project files are errors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        '.gspot/version': `${RUNNING_VERSION}\n`,
        'main.py': 'value = 1\n',
        'pyproject.toml': '# [tool.importlinter] is only a comment\n',
    });
    const command = ['check', '--only', 'python/import-linter', '--json'];
    const absent = await runGspot(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    expect((JSON.parse(absent.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'python/import-linter',
            status: 'skipped',
            note: 'This scope has no import-linter configuration.',
        },
    ]);
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[broken');
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
        resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'lint-imports')]));
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
        expect(await rejection(importLinter(buildEngineInput(session, 'python/import-linter')))).toBe(
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
    resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'lint-imports')]));
    const command = resources.use(
        spyOn(processes, 'run').mockResolvedValue({
            code: 1,
            stdout: 'First boundary BROKEN (1 ignored import)\nSecond boundary BROKEN [0.1s]\n\n\u001B[1mBroken contracts\u001B[0m\n----------------\n\u001B[1mFirst boundary\u001B[0m\n--------------\nexample.low -> example.high (l. 1)\n\nSecond boundary\n---------------\nexample.other -> example.high (l. 3)\n',
            stderr: '',
            missing: false,
            duration: 1,
        }),
    );
    const findings = await importLinter(buildEngineInput(session, 'python/import-linter'));
    expect(findings.map((finding) => [finding.file, finding.rule])).toStrictEqual([
        ['setup.cfg', 'contract'],
        ['setup.cfg', 'contract'],
    ]);
    expect(findings[0]?.message).toContain('example.low -> example.high (l. 1)');
    expect(findings[0]?.message).not.toContain('example.other');
    expect(findings[1]?.message).toContain('example.other -> example.high (l. 3)');
    expect(command.mock.calls[0]?.[0]).toContain('setup.cfg');
    expect(await Bun.file(join(sandbox.path, 'setup.cfg')).text()).toBe(config);
});

test('deptry skips a standalone script without a project and rejects malformed project metadata', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        '.gspot/version': `${RUNNING_VERSION}\n`,
        'main.py': 'value = 1\n',
    });
    const command = ['check', '--only', 'python/deptry', '--json'];
    const absent = await runGspot(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    expect((JSON.parse(absent.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/deptry', status: 'skipped', note: 'This scope has no pyproject.toml for deptry to read.' },
    ]);
    writeFileSync(join(sandbox.path, 'pyproject.toml'), '[broken');
    const malformed = await runGspot(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/deptry', status: 'error' },
    ]);
});
