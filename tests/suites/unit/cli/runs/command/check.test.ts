import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckCommand, buildCommandSetup } from '#cli/runs/command/check.ts';
import { writeScriptCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

import {
    BASH_SYNTAX_CHECK,
    DASHED_FILE_SCRIPT,
    PENDING_NOTES_SCRIPT,
    CHILD_SCOPE_SETTINGS,
    PENDING_NOTE_RESULTS,
    DASHED_FILE_PLACEHOLDERS,
} from '#tests/config/runs/command.ts';

test.each(DASHED_FILE_PLACEHOLDERS)(
    '%s keeps filenames beginning with a dash out of tool options',
    async (placeholder) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], {
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/dashed-files',
                            command: [process.execPath, '-e', DASHED_FILE_SCRIPT, '--', placeholder],
                            paths: ['*.sh', '*.mjs'],
                            stage: 'commit',
                            output: {
                                format: 'regex',
                                pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$`,
                            },
                        },
                    ],
                }),
            }),
            '-f.sh': 'invalid',
            '--config=x.mjs': 'invalid',
        });
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['project/dashed-files'] }),
        );
        expect(result.report.exitCode).toBe(1);
        expect(result.report.checks).toMatchObject([{ status: 'failed', fileCount: 2 }]);
        expect(
            result.report.checks
                .flatMap(({ findings }) => findings.map(({ file }) => file))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['--config=x.mjs', '-f.sh']);
    },
);

test('a command check runs its command and reports file and line through its output format', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: String.raw`[[command_check]]
id = "notes/no-pending"
command = ${JSON.stringify([process.execPath, '-e', PENDING_NOTES_SCRIPT, '{files}'])}
paths = ["notes/**"]
stage = "commit"
summary = "Finds pending notes left in the notes folder."

[command_check.output]
format = "regex"
pattern = '^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$'
`,
        }),
        'notes/plan.txt': 'one\nPENDING later\n',
    });

    const check = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'notes/no-pending', '--json']));
    expect(check.code, check.stdout + check.stderr).toBe(1);
    expect(check.report.checks).toMatchObject([...PENDING_NOTE_RESULTS]);
});

test('a Python check that runs in a copy uses the environment that the working tree installed', async () => {
    await using working = await testdir();
    await using sandbox = await testdir();
    const files = {
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\nrequires-python = ">=3.12"\n',
        'uv.lock': 'version = 1\n',
        'app/main.py': 'import requests\n',
    };
    await createFileTree(working.path, { ...files, '.venv/pyvenv.cfg': 'home = /usr/bin\n' });
    await createFileTree(sandbox.path, files);
    const session = await openSession(sandbox.path, { installedRoot: working.path });
    const planned = planChecks(session, buildRunOptions({ only: ['python/basedpyright'] })).find(
        ({ check }) => check.id === 'python/basedpyright',
    )!;
    expect(buildCommandSetup(session, planned, {}).env['UV_PROJECT_ENVIRONMENT']).toBe(join(working.path, '.venv'));
    const inPlace = await openSession(working.path);
    const local = planChecks(inPlace, buildRunOptions({ only: ['python/basedpyright'] })).find(
        ({ check }) => check.id === 'python/basedpyright',
    )!;
    expect(buildCommandSetup(inPlace, local, {}).env).not.toHaveProperty('UV_PROJECT_ENVIRONMENT');
});
test('a command in a scope runs in the scope folder with paths relative to it', async () => {
    await using sandbox = await testdir();
    const scope = 'apps/café [web]';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['swift'], { scopes: [{ path: scope }] }),
        '--config=x.swift': 'let value = 1\n',
        [`${scope}/--config=x.swift`]: 'let value = 2\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
    expect(planned.map((check) => check.scope.folder.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        const setup = buildCommandSetup(session, check, {});
        expect(setup.cwd).toBe(join(sandbox.path, check.scope.folder.path));
        expect(setup.files).toStrictEqual(['./--config=x.swift']);
        expect(setup.substitutions.files).toStrictEqual(['./--config=x.swift']);
    }
});
test.skipIf(isWindows)('a command check whose program lost its execute bit errors with exit code 2', async () => {
    await using sandbox = await testdir();
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/checker',
                        output: { format: 'none' },
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: [executable],
                    },
                ],
            }),
        }),
        'source.txt': 'input\n',
    });
    await writeScriptCommand(sandbox.path, 'checker', 'process.exitCode = 0;\n');
    await chmod(executable, 0o644);
    const options = buildRunOptions({ stage: 'commit', only: ['project/checker'] });
    const unexecutable = await runChecks(await openSession(sandbox.path), options);
    expect(unexecutable.report.exitCode).toBe(2);
    expect(unexecutable.report.checks.map(({ status }) => status)).toStrictEqual(['error']);
});
test('per-file failures name the selected file when expanded arguments follow it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/file-result',
                        command: [
                            process.execPath,
                            'validate.cjs',
                            '{existing:--config:settings.txt}',
                            '{file}',
                            'config',
                            '--quiet',
                        ],
                        paths: ['inputs/**'],
                        stage: 'commit',
                    },
                ],
            }),
        }),
        'settings.txt': '',
        'inputs/café source.txt': 'invalid',
        'validate.cjs':
            'const fs = require("node:fs"); process.exitCode = fs.readFileSync(process.argv[4], "utf8") === "valid" ? 0 : 1;',
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['project/file-result'] });
    const planned = plans[0]!;
    const failed = await runCheckCommand(session, planned);
    expect(failed.status).toBe('failed');
    expect(failed.findings.map((finding) => finding.file)).toStrictEqual(['inputs/café source.txt']);
});
test.skipIf(isWindows)('a per-file process killed by a signal is an error, not a finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/termination',
                        command: [process.execPath, '-e', 'process.kill(process.pid, "SIGTERM")', '{file}'],
                        paths: ['source.txt'],
                        stage: 'commit',
                    },
                ],
            }),
        }),
        'source.txt': 'valid source',
    });

    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'all', only: ['project/termination'] });
    const planned = plans[0]!;
    const failed = await runCheckCommand(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
});
test('a command run in a copy finds the other tools beside its program before a PATH entry', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/companion',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: [join(sandbox.path, 'native/checker')],
                    },
                ],
            }),
        }),
        'source.txt': '',
        'copy/.keep': '',
    });
    await writeScriptCommand(
        sandbox.path,
        'native/checker',
        "const result = Bun.spawnSync(['shellcheck', '--version']); process.stdout.write(result.stdout); process.exitCode = result.exitCode;",
    );
    await writeScriptCommand(sandbox.path, 'native/shellcheck', "console.log('ShellCheck version: 0.11.0');");
    await writeScriptCommand(sandbox.path, 'inactive/shellcheck', 'process.exit(7);');
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['project/companion'] })[0]!;
    using _environment = overrideEnvironment({ PATH: join(sandbox.path, 'inactive') });
    using _which = fakeExecutableLookup(join(sandbox.path, `native/shellcheck${isWindows ? '.cmd' : ''}`));

    const result = await runCheckCommand(session, planned, { copyRoot: join(sandbox.path, 'copy') });
    expect(result.status, result.note).toBe('passed');
    expect(result.findings).toStrictEqual([]);
});
test.skipIf(isWindows)('a command check reports files whose folder names hold a colon or a newline', async () => {
    await using sandbox = await testdir();
    const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
    });
    const options = buildRunOptions({ only: ['project/bash-syntax'] });
    const broken = await runChecks(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(
        [...new Set(broken.report.checks[0]!.findings.map((finding) => finding.file))].toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(paths);
});
test('a command check at the root checks a changed file of a child scope once', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], CHILD_SCOPE_SETTINGS),
        'api/source.sh': 'if then\n',
        'web/source.sh': 'echo sibling\n',
    });

    const options = buildRunOptions({
        stage: 'push',
        only: ['project/syntax'],
        changed: ['api/source.sh'],
    });
    const failed = await runChecks(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'failed' },
    ]);
});
test('a command without an extra config-file list refuses its missing declared config file before running', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'source.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['format/prettier'] })[0]!;
    const command = ['prettier', '--config', '{config_file:prettier}', '{files}'];
    const result = await runCheckCommand(session, { ...planned, check: { ...planned.check, command } });
    expect(result).toMatchObject({
        status: 'error',
        note: 'The config file .gspot/configurations/general/format/prettier.json is missing. Run gspot apply.',
        findings: [],
    });
});
