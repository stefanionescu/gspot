import executables from 'which';
import { stringify } from 'smol-toml';
import { join, delimiter } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/checks/run/run.ts';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildManifest } from '#tests/setup/manifest.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { chmod, symlink, writeFile } from 'node:fs/promises';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/bash/tools.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { TWO_SCOPES_SETTINGS } from '#tests/config/settings/scopes.ts';
import { runCheckCommand, commandEnvironment } from '#cli/checks/run/command/check.ts';

// A checker that passes, and one that fails.
const PASSING_SCRIPT = `#!${process.execPath}\nprocess.exitCode = 0;\n`;

const FAILING_SCRIPT = `#!${process.execPath}\nprocess.exitCode = 1;\n`;

test('a check command runs with a tool file that is a link inside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift']),
        'source.swift': 'let value = 1\n',
        'settings/swiftlint.yml': 'disabled_rules: []\n',
        '.gspot/config/swiftlint.yml': 'disabled_rules: []\n',
    });
    await symlink('settings/swiftlint.yml', join(sandbox.path, '.swiftlint.yml'));
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['swift/swiftlint'] })[0]!;
    planned.check = {
        ...planned.check,
        command: [process.execPath, '-e', 'process.exitCode = 0'],
        output: { format: 'lines', file_type: 'path' },
    };
    planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
    const result = await runCheckCommand(session, planned, CHECK_IMPLEMENTATIONS['swift/swiftlint']);
    expect(result.status, result.note).toBe('passed');
    expect(result.findings).toStrictEqual([]);
});

test('a command in a scope runs in the scope folder with paths relative to it', async () => {
    await using sandbox = await testdir();
    const scope = 'apps/café [web]';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift'], { tables: `[[scope]]\npath = ${JSON.stringify(scope)}\n` }),
        'Sources/Main.swift': 'let value = 1\n',
        [`${scope}/Sources/Main.swift`]: 'let value = 2\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['swift/swiftlint'] });
    expect(planned.map((check) => check.scope.scope.path)).toStrictEqual(['', scope]);
    for (const check of planned) {
        const environment = commandEnvironment(session, check, {});
        expect(environment.cwd).toBe(join(sandbox.path, check.scope.scope.path));
        expect(environment.files).toStrictEqual(['Sources/Main.swift']);
        expect(environment.substitutions.files).toStrictEqual(['Sources/Main.swift']);
    }
});

test('a tool below its minimum version is reported missing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            tables: `[[command_check]]\nname = "project/checker"\noutput = { format = "none" }\nstage = "commit"\npaths = ["source.txt"]\ncommand = ["checker"]\n`,
        }),
        'source.txt': 'input\n',
    });
    const manifest = buildManifest('sample', {
        tables: `[[tool]]
name = "checker"
min_version = "24.0.0"
system = true
[[check]]
name = "checker"
level = "recommended"
stage = "commit"
command = ["checker"]
summary = "Checks the sample."
example = "A sample program reports its version."
why = "The program needs the accepted version."
help = "Install the accepted version."
`,
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['project/checker'] })[0]!;
    planned.check = manifest.checks[0]!;
    planned.tool = manifest.tools.find((tool) => typeof tool !== 'string')!;
    await fakeTool(sandbox.path, 'checker', 'if (process.argv.includes("--version")) console.log("26.8.0");');
    using resources = new DisposableStack();
    resources.use(
        useEnvironment({
            PATH: [sandbox.path, readEnvironmentVariable('PATH')].filter(Boolean).join(delimiter),
        }),
    );
    const initial = await runCheckCommand(session, planned);
    expect(initial.status, initial.note).toBe('passed');
    await fakeTool(sandbox.path, 'checker', 'if (process.argv.includes("--version")) console.log("23.0.0");');
    session.inspections.clear();
    const changed = await runCheckCommand(session, planned);
    expect(changed.status).toBe('missing');
    expect(changed.note).toContain('23.0.0 is below 24.0.0');
});

// Windows keeps no permission bits to read back.
test.skipIf(isWindows)('a session that runs again uses a replaced program and reads its permissions', async () => {
    await using sandbox = await testdir();
    const executable = join(sandbox.path, 'checker');
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            tables: `[[command_check]]
name = "project/checker"\noutput = { format = "none" }\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([executable])}\n`,
        }),
        'source.txt': 'input\n',
        checker: PASSING_SCRIPT,
    });
    await chmod(executable, 0o755);
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'commit', only: ['project/checker'] });
    const executed = await executeRun(session, options);
    expect(executed.report.exitCode).toBe(0);
    const repeated = await executeRun(await openSession(session.root), options);
    expect(repeated.report.checks[0]!.status).toBe('passed');
    await writeFile(executable, FAILING_SCRIPT);
    const changed = await executeRun(await openSession(session.root), options);
    expect(changed.report.exitCode).toBe(1);
    expect(changed.report.checks[0]!.status).toBe('failed');
    await chmod(executable, 0o644);
    const unexecutable = await executeRun(await openSession(session.root), options);
    expect(unexecutable.report.exitCode).toBe(2);
    await chmod(executable, 0o755);
    await writeFile(executable, PASSING_SCRIPT);
    const restored = await executeRun(await openSession(session.root), options);
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
    planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
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
    planned.tool = { name: process.execPath, installers: {}, kind: 'program' };
    const failed = await runCheckCommand(session, planned);
    expect(failed.status).toBe('error');
    expect(failed.findings).toStrictEqual([]);
});

test('a command run in a copy uses its declared companion program, not an inactive PATH entry', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'project/companion',
                    stage: 'commit',
                    paths: ['source.txt'],
                    command: [
                        process.execPath,
                        '-e',
                        "const result = Bun.spawnSync(['shellcheck', '--version']); process.stdout.write(result.stdout); process.exitCode = result.exitCode;",
                    ],
                },
            ],
        }),
        'source.txt': '',
        'copy/.keep': '',
    });
    await fakeTool(sandbox.path, 'native/shellcheck', "console.log('ShellCheck version: 0.11.0');");
    await fakeTool(sandbox.path, 'inactive/shellcheck', 'process.exit(7);');
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['project/companion'] })[0]!;
    planned.check.other_tools = ['shellcheck'];
    planned.check.env = { PATH: join(sandbox.path, 'inactive') };
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
        'gspot.toml': settingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
    });
    const options = buildRunOptions({ only: ['project/bash-syntax'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
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
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'failed' },
    ]);
});
