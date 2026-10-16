import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildVenvBinPath } from '#cli/system/paths.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { IMPORT_CONTRACT_REPORT } from '#tests/config/python/imports.ts';
import { toolDeclaration, toolProjectPins } from '#cli/configurations/tool-pins.ts';

test('import-linter skips a project without contracts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python']),
        'main.py': 'value = 1\n',
        'pyproject.toml': '# [tool.importlinter] is only a comment\n',
    });
    const command = ['check', '--only', 'python/import-linter', '--json'];
    const absent = await checkReport(sandbox.path, command);
    expect(absent.code, absent.stdout + absent.stderr).toBe(0);
    const report = absent.report;
    expect(report.checks).toMatchObject([{ check: 'python/import-linter', status: 'skipped' }]);
});

test('import-linter reads setup.cfg first and reports each broken contract with its import chain', async () => {
    await using sandbox = await testdir();
    const config = '[importlinter]\nroot_package = example\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python']),
        'setup.cfg': config,
        '.importlinter': config,
        'pyproject.toml': '[tool.importlinter]\nroot_package = "example"\n',
        'example/__init__.py': '',
        [join(buildVenvBinPath('.gspot/.venv'), 'lint-imports')]: 'fixture',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(
        mockPinnedExecutables([
            toolDeclaration(session.manifests.values(), 'uv'),
            toolDeclaration(session.manifests.values(), 'lint-imports'),
        ]),
    );
    const command = resources.use(
        spyOn(processes, 'run').mockResolvedValue(processResult({ code: 1, stdout: IMPORT_CONTRACT_REPORT })),
    );
    const findings = await checkFindings(session.root, 'python/import-linter');
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
        ...toolProjectPins([...session.manifests.values()]).python.filter((pin) => pin.startsWith('import-linter==')),
        'lint-imports',
        '--no-cache',
        '--verbose',
        '--config',
        'setup.cfg',
    ]);
    expect(command.mock.calls.map(([, options]) => options.env?.['PYTHONDONTWRITEBYTECODE'])).toStrictEqual(['1']);
});
