import { writeFile } from 'node:fs/promises';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { OS_VALUE_SOURCE, PYTHON_ENVIRONMENT_SOURCE } from '#tests/config/configurations/structure/files.ts';
import { BASH_HEADER } from '#tests/config/setup/languages.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('Swift environment reads outside the env files are reported; comments and strings are not', async () => {
    await using sandbox = await createGitSandbox({
        'Sources/Screen.swift': `let live = ProcessInfo.processInfo.environment["KEY"]
// ProcessInfo.processInfo.environment
let literal = "ProcessInfo.processInfo.environment"
let spaced = ProcessInfo . processInfo . environment
`,
        'gspot.toml': buildSandboxSettings(['swift'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["Sources/Environment.swift"]\n',
        }),
    });
    const result = await runSandboxCheck(sandbox.path, 'structure/environment-readers');
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Screen.swift', line: 1, rule: 'read-outside-reader' },
        { file: 'Sources/Screen.swift', line: 4, rule: 'read-outside-reader' },
    ]);
    await writeFile(
        `${sandbox.path}/gspot.toml`,
        buildSandboxSettings(['swift'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["Sources/Screen.swift"]\n',
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'structure/environment-readers')).toStrictEqual([]);
});

test('Python reads through os aliases are reported; shadowed and unrelated names are not', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: '[structure]\nenvironment_readers = ["environment.py"]\n',
        }),
        'environment.py': OS_VALUE_SOURCE,
        'main.py': PYTHON_ENVIRONMENT_SOURCE,
    });
    const initial = await runSandboxCheck(sandbox.path, 'structure/environment-readers');
    expect(initial.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
        [3, 4, 5, 6].map((line) => ({ file: 'main.py', line, rule: 'read-outside-reader' })),
    );

    await writeFile(
        `${sandbox.path}/main.py`,
        'from unrelated import environ, getenv\nfirst = environ["KEY"]\nsecond = getenv("KEY")\n',
    );
    expect(await runSandboxCheck(sandbox.path, 'structure/environment-readers')).toStrictEqual([]);
});

test('each scope uses its own environment readers', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['python'] }],
            tables: '[structure]\nenvironment_readers = ["environment.py"]\n[scope.structure]\nenvironment_readers = ["environment.py"]\n',
        }),
        'environment.py': OS_VALUE_SOURCE,
        'main.py': OS_VALUE_SOURCE,
        'app/environment.py': 'import os\nVALUE = os.getenv("KEY")\n',
        'app/main.py': 'from os import getenv as read\nVALUE = read("KEY")\n',
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/environment-readers'] }),
    );
    expect(
        result.report.checks.flatMap(({ findings }) => findings).map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([
        { file: 'main.py', line: 2 },
        { file: 'app/main.py', line: 2 },
    ]);
});

test('structure/environment-readers reports read-outside-reader in scripts/reader.sh and passes after the fix', async () => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(
        sandbox,
        {
            check: 'structure/environment-readers',
            files: {
                'scripts/environment.sh': `#!/usr/bin/env bash
#
# Owns the environment.
# Runtime: Bash 4.0+, macOS and Linux.

readonly DEPLOY_TARGET="\${1:-}"
`,
                'scripts/reader.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "\${DEPLOY_TARGET} $1"
}

main "$@"
`,
            },
            settings: '[structure]\nenvironment_readers = ["scripts/environment.sh"]\n',
            expected: { file: 'scripts/reader.sh', rule: 'read-outside-reader', line: 10 },
            corrected: {
                files: {
                    'scripts/environment.sh': '#!/usr/bin/env bash\nreadonly DEPLOY_TARGET="${1:-}"\n',
                    'scripts/reader.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "$1"
}

main "$@"
`,
                },
            },
        },
        BASH_SANDBOX.cleanSource,
    );
});

test('an environment function of the secrets settings counts as a read', async () => {
    const readers = '[structure]\nenvironment_readers = ["environment.py"]\n';
    const files = { 'environment.py': OS_VALUE_SOURCE, 'main.py': 'VALUE = read_env("KEY")\n' };
    await using named = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['python', 'secrets'], {
            level: 'all',
            tables: `${readers}[secrets]\nenvironment_functions = ["read_env"]\n`,
        }),
    });
    const findings = await runSandboxCheck(named.path, 'structure/environment-readers');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'main.py', line: 1, rule: 'read-outside-reader' },
    ]);
    await using unnamed = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['python', 'secrets'], { level: 'all', tables: readers }),
    });
    expect(await runSandboxCheck(unnamed.path, 'structure/environment-readers')).toStrictEqual([]);
});
