import executables from 'which';
import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { fakeTool } from '#tests/setup/fakes.ts';
import { planRun } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { chmod, symlink, writeFile } from 'node:fs/promises';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { TWO_SCOPES_SETTINGS } from '#tests/data/settings/scopes.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { runCheckCommand, buildCommandEnvironment } from '#cli/checks/run/command/check.ts';

test('a check command accepts a configuration input linked inside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'project/linked-config',
                    paths: ['*.swift'],
                    stage: 'commit',
                    command: [process.execPath, '-e', 'process.exitCode = 0', '{existing:--config:.swiftlint.yml}'],
                    output: { format: 'lines', file_type: 'path' },
                },
            ],
        }),
        'source.swift': 'let value = 1\n',
        'settings/swiftlint.yml': 'disabled_rules: []\n',
    });
    await symlink('settings/swiftlint.yml', join(sandbox.path, '.swiftlint.yml'));
    const checked = await checkReport(sandbox.path, ['check', '--only', 'project/linked-config', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('a command in a scope runs in the scope folder with paths relative to it', async () => {
    await using sandbox = await testdir();
    const scope = 'apps/café [web]';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['swift'], { tables: `[[scope]]\npath = ${JSON.stringify(scope)}\n` }),
        'Sources/Main.swift': 'let value = 1\n',
        [`${scope}/Sources/Main.swift`]: 'let value = 2\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['swift/swiftlint'] });
    expect(planned.map((check) => check.selection.scope.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        const environment = buildCommandEnvironment(session, check, {});
        expect(environment.cwd).toBe(join(sandbox.path, check.selection.scope.path));
        expect(environment.files).toStrictEqual(['Sources/Main.swift']);
        expect(environment.substitutions.files).toStrictEqual(['Sources/Main.swift']);
    }
});

// Windows keeps no permission bits to read back.
test.skipIf(isWindows)('a session that runs again uses a replaced program and reads its permissions', async () => {
    const passingScript = `#!${process.execPath}\nprocess.exitCode = 0;\n`;
    const failingScript = `#!${process.execPath}\nprocess.exitCode = 1;\n`;

    await using sandbox = await testdir();
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], {
            tables: `[[command_check]]
name = "project/checker"\noutput = { format = "none" }\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([executable])}\n`,
        }),
        'source.txt': 'input\n',
        checker: passingScript,
    });
    await chmod(executable, 0o755);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'commit', only: ['project/checker'] });
    const executed = await runChecks(session, options);
    expect(executed.report.exitCode).toBe(0);
    const repeated = await runChecks(await openSession(session.root), options);
    expect(repeated.report.checks[0]!.status).toBe('passed');
    await writeFile(executable, failingScript);
    const changed = await runChecks(await openSession(session.root), options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.status).toBe('failed');
    await chmod(executable, 0o644);
    const unexecutable = await runChecks(await openSession(session.root), options);
    expect(unexecutable.report.exitCode).toBe(2);
    await chmod(executable, 0o755);
    await writeFile(executable, passingScript);
    const restored = await runChecks(await openSession(session.root), options);
    expect(restored.report.exitCode).toBe(0);
});

test('per-file failures name the selected file when expanded arguments follow it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'project/file-result',
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
        'settings.txt': '',
        'inputs/café source.txt': 'invalid',
        'validate.cjs':
            'const fs = require("node:fs"); process.exitCode = fs.readFileSync(process.argv[4], "utf8") === "valid" ? 0 : 1;',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['project/file-result'] });
    const planned = plans[0]!;
    const failed = await runCheckCommand(session, planned);
    expect(failed.status).toBe('failed');
    expect(failed.findings.map((finding) => finding.file)).toStrictEqual(['inputs/café source.txt']);
});

// Windows has no signals: a process that kills itself exits with a code.
test.skipIf(isWindows)('a per-file process killed by a signal is an error, not a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'project/termination',
                    command: [process.execPath, '-e', 'process.kill(process.pid, "SIGTERM")', '{file}'],
                    paths: ['source.txt'],
                    stage: 'commit',
                },
            ],
        }),
        'source.txt': 'valid source',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['project/termination'] });
    const planned = plans[0]!;
    const failed = await runCheckCommand(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
});

test("a command run in a copy finds its chosen program's companion before an inactive PATH entry", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'project/companion',
                    stage: 'commit',
                    paths: ['source.txt'],
                    command: [join(sandbox.path, 'native/checker')],
                },
            ],
        }),
        'source.txt': '',
        'copy/.keep': '',
    });
    await fakeTool(
        sandbox.path,
        'native/checker',
        "const result = Bun.spawnSync(['shellcheck', '--version']); process.stdout.write(result.stdout); process.exitCode = result.exitCode;",
    );
    await fakeTool(sandbox.path, 'native/shellcheck', "console.log('ShellCheck version: 0.11.0');");
    await fakeTool(sandbox.path, 'inactive/shellcheck', 'process.exit(7);');
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['project/companion'] })[0]!;
    using _environment = overrideEnvironment({ PATH: join(sandbox.path, 'inactive') });
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) => {
        const path = join(sandbox.path, `native/shellcheck${isWindows ? '.cmd' : ''}`);
        return options?.all === true ? [path] : path;
    }) as typeof executables.sync);

    const result = await runCheckCommand(session, planned, { scratchRoot: join(sandbox.path, 'copy') });
    expect(result.status, result.note).toBe('passed');
    expect(result.findings).toStrictEqual([]);
});

// Windows forbids a colon in a file or folder name.
test.skipIf(isWindows)('a command check reports files whose folder name has a colon', async () => {
    await using sandbox = await testdir();
    const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `${TWO_SCOPES_SETTINGS}\n[[command_check]]
name = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\noutput.format = "none"\npaths = ["**/*.sh"]\nstage = "push"\n`,
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
