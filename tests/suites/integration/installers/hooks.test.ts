import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_MISE_TOOL } from '#cli/config/repository/javascript.ts';
import { readGitSetting } from '#cli/repository/git/run.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { MISE_TRUST, TOOL_PINS_FILE } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspot, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runtimePinsSchema } from '#tests/setup/schemas.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

const UNQUOTED_FINDING_PREFIX = '  scripts/b.sh:2:6  SC2086  ';

const UNQUOTED_SCRIPT = '#!/usr/bin/env bash\necho $1\n';

const HOOKS_OFF_SETTINGS = '[hooks]\nenabled = false\n';

async function assertCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await createGitSandbox({});
    const clone = join(cloneRoot.path, 'clone');
    runGitStep(source, ['clone', '--quiet', '--no-local', source, clone]);
    await writeRuntimePins(clone);
    const uninstalled = parseCheckReport(await runGspot(clone, ['check', '--only', 'bash/shellcheck', '--json']));
    expect(uninstalled.code, uninstalled.stdout + uninstalled.stderr).toBe(0);
    expect(uninstalled.report).toMatchObject({
        stages: ['commit', 'push'],
        checks: [{ check: 'bash/shellcheck', scope: '', status: 'passed', fileCount: 2, findings: [] }],
        exitCode: 0,
    });
    for (let round = 0; round < 2; round++) {
        const installation = await spawnGspot(clone, ['install']);
        expect(installation.code, installation.stdout + installation.stderr).toBe(0);
        expect(runGitStep(clone, ['status', '--porcelain'])).toBe('');
    }
    await writeFile(join(clone, 'scripts/b.sh'), UNQUOTED_SCRIPT);
    runGitStep(clone, ['add', 'scripts/b.sh']);
    const rejected = await runCommand(['git', 'commit', '-qm', 'Unquoted shell input'], {
        cwd: clone,
        env: environment,
    });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const rejectedOutput = rejected.stdout + rejected.stderr;
    expect(
        rejectedOutput.split('\n').some((line) => line.startsWith(UNQUOTED_FINDING_PREFIX)),
        rejectedOutput,
    ).toBe(true);
    await writeFile(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\nprintf \'%s\\n\' "${1:-ready}"\n');
    runGitStep(clone, ['add', 'scripts/b.sh']);
    const accepted = await runCommand(['git', 'commit', '-qm', 'Quote shell input'], {
        cwd: clone,
        env: environment,
    });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
}

test('a fresh clone checks before its install, keeps its tracked files through two installs, and its hook fails a ShellCheck finding and passes after the fix', async () => {
    await using sandbox = await testdir({
        '.editorconfig': '[*]\nindent_style = space\nindent_size = 4\n',
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });

    await writeRuntimePins(sandbox.path);
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, ['init', '--configurations', 'bash']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\nprintf \'%s\\n\' "$1"\n');
    runGitStep(sandbox.path, ['add', '-A']);
    runGitStep(sandbox.path, ['commit', '--no-verify', '-qm', 'Add the generated files']);
    // init pins the published gspot in mise.toml, and mise starts a pinned tool before the PATH. With that pin off, the
    // hook starts the build that the test PATH names.
    await assertCloneHooks(sandbox.path, { NO_COLOR: '1', MISE_DISABLE_TOOLS: GSPOT_MISE_TOOL });
});

test('a commit in a linked worktree runs staged checks and blocks a finding', async () => {
    await using sandbox = await createGitSandbox({});
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');

    const files = {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                hooks: { enabled: true },
                command_check: [
                    {
                        ...buildReportingCheck({ id: 'sandbox/defect', paths: ['src/**'], stage: 'commit' }),
                        command: buildProgramCommand(
                            'checks/search',
                            '--text',
                            'DEFECT',
                            '--report',
                            'path',
                            '--',
                            '{files}',
                        ),
                    },
                ],
            }),
        }),
        'src/kept.txt': 'clean\n',
    };
    await createFileTree(main, files);
    await writeRuntimePins(main);
    commitAll(main);
    const environment = { NO_COLOR: '1' };
    await runGspotStep({ root: main, run: spawnGspot }, ['install']);
    const formatted = await spawnGspot(main, ['check', '--only', 'toml/taplo', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    commitAll(main);
    runGitStep(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    await writeRuntimePins(linked);
    const installed = await spawnGspot(linked, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(linked, 'src/added.txt'), 'DEFECT\n');
    runGitStep(linked, ['add', 'src/added.txt']);
    const blocked = await runCommand(['git', 'commit', '-qm', 'Defect'], { cwd: linked, env: environment });
    expect(blocked.code, blocked.stdout + blocked.stderr).toBe(1);
    expect((blocked.stdout + blocked.stderr).split('\n')).toContain('  src/added.txt');
    await writeFile(join(linked, 'src/added.txt'), 'clean\n');
    runGitStep(linked, ['add', 'src/added.txt']);
    const accepted = await runCommand(['git', 'commit', '-qm', 'Clean'], { cwd: linked, env: environment });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test('a hook ignores a nested gspot.toml and checks the index at the Git root', async () => {
    await using sandbox = await createGitSandbox({});
    const project = join(sandbox.path, 'nested config');
    const command = buildProgramCommand(
        'checks/search',
        '--text',
        'invalid',
        '--report',
        'message',
        '--message',
        'Indexed defect',
        'source.txt',
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                rule_files: { enabled: false },
                hooks: { enabled: true },
                command_check: [{ id: 'project/content', stage: 'commit', paths: ['source.txt'], command }],
            }),
        }),
        'nested config/gspot.toml': buildSandboxSettings([], { tables: HOOKS_OFF_SETTINGS }),
        'source.txt': 'invalid\n',
    });
    await writeRuntimePins(sandbox.path);
    await applyGeneratedFiles(project);
    const installed = await spawnGspot(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    const formatted = await spawnGspot(project, ['check', '--only', 'toml/taplo', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '-A']);
    await writeFile(join(sandbox.path, 'source.txt'), 'corrected working tree\n');
    const rejected = await runCommand(['git', 'hook', 'run', 'pre-commit'], { cwd: sandbox.path, env: {} });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect((rejected.stdout + rejected.stderr).split('\n')).toContain('  source.txt:1  Indexed defect');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected working tree\n');
    runGitStep(sandbox.path, ['add', 'source.txt']);
    const corrected = await runCommand(['git', 'hook', 'run', 'pre-commit'], { cwd: sandbox.path, env: {} });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

async function writeRuntimePins(root: string): Promise<void> {
    if (!existsSync(join(root, TOOL_PINS_FILE))) {
        const pins = await readFile(join(REPOSITORY_ROOT, TOOL_PINS_FILE), 'utf8');
        const { tools } = runtimePinsSchema.parse(parse(pins));
        await writeFile(join(root, TOOL_PINS_FILE), stringify({ tools }));
    }
    const trusted = await runCommand([...MISE_TRUST, TOOL_PINS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}
