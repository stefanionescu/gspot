import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { envOwner } from '#cli/checks/general/structure/env-owner.ts';
import { ENVIRONMENT_SOURCE, PYTHON_ENVIRONMENT_SOURCE } from '#tests/config/cli/checks/general/structure/env-owner.ts';

test('Swift environment reads require an owner and ignore comments and string literals', async () => {
    await using sandbox = await testdir({
        'Sources/Screen.swift': ENVIRONMENT_SOURCE,
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
    });
    expect(await envOwner(buildCheckInput(await openSession(sandbox.path), 'structure/env-owner'))).toStrictEqual([]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[architecture.roles]\nenv = ["Sources/Environment.swift"]\n' }),
    );
    const result = await envOwner(buildCheckInput(await openSession(sandbox.path), 'structure/env-owner'));
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Screen.swift', line: 1, rule: 'read-outside-owner' },
        { file: 'Sources/Screen.swift', line: 4, rule: 'read-outside-owner' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[architecture.roles]\nenv = ["Sources/Screen.swift"]\n' }),
    );
    expect(await envOwner(buildCheckInput(await openSession(sandbox.path), 'structure/env-owner'))).toStrictEqual([]);
});

test.each(['recommended', 'all'] as const)(
    'Python environment aliases use native bindings at level %s',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['python'], {
                level,
                tables: '[architecture.roles]\nenv = ["environment.py"]\n',
            }),
            'environment.py': 'import os\nVALUE = os.environ["KEY"]\n',
            'main.py': PYTHON_ENVIRONMENT_SOURCE,
        });
        const initial = await runGspot(sandbox.path, ['check', '--only', 'structure/env-owner', '--json']);
        const checks = (JSON.parse(initial.stdout) as RunReport).checks;
        expect(
            checks.flatMap(({ findings }) => findings).map(({ file, line, rule }) => ({ file, line, rule })),
        ).toStrictEqual(
            level === 'recommended'
                ? []
                : [3, 4, 5, 6].map((line) => ({ file: 'main.py', line, rule: 'read-outside-owner' })),
        );
        expect(initial.code).toBe(level === 'recommended' ? 0 : 1);
        await Bun.write(
            `${sandbox.path}/main.py`,
            'from unrelated import environ, getenv\nfirst = environ["KEY"]\nsecond = getenv("KEY")\n',
        );
        const corrected = await runGspot(sandbox.path, ['check', '--only', 'structure/env-owner', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
            [],
        );
    },
);

test.each(['recommended', 'all'] as const)('Python scoped environment owners apply at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            level,
            tables: '[architecture.roles]\nenv = ["environment.py"]\n[scope.app]\nconfigurations = ["python"]\n[scope.app.architecture.roles]\nenv = ["environment.py"]\n',
        }),
        'environment.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'main.py': 'import os\nVALUE = os.environ["KEY"]\n',
        'app/environment.py': 'import os\nVALUE = os.getenv("KEY")\n',
        'app/main.py': 'from os import getenv as read\nVALUE = read("KEY")\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'structure/env-owner', '--json']);
    expect(
        (JSON.parse(result.stdout) as RunReport).checks
            .flatMap(({ findings }) => findings)
            .map(({ file, line }) => ({ file, line })),
    ).toStrictEqual(
        level === 'recommended'
            ? []
            : [
                  { file: 'main.py', line: 2 },
                  { file: 'app/main.py', line: 2 },
              ],
    );
    expect(result.code).toBe(level === 'recommended' ? 0 : 1);
});
