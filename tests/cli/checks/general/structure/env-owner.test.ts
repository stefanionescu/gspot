import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { envOwner } from '#cli/checks/general/structure/env-owner.ts';
import { ENVIRONMENT_SOURCE } from '#tests/config/cli/checks/general/structure/env-owner.ts';

test('Swift environment reads require an owner and ignore comments and string literals', async () => {
    await using sandbox = await testdir({
        'Sources/Screen.swift': ENVIRONMENT_SOURCE,
        'gspot.toml': buildPolicy(['swift'], { level: 'all' }),
    });
    expect(await envOwner(buildCheckInput(await openSession(sandbox.path), 'swift/env-owner'))).toStrictEqual([]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[architecture.roles]\nenv = ["Sources/Environment.swift"]\n' }),
    );
    const result = await envOwner(buildCheckInput(await openSession(sandbox.path), 'swift/env-owner'));
    expect(result.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Screen.swift', line: 1, rule: 'read-outside-owner' },
        { file: 'Sources/Screen.swift', line: 4, rule: 'read-outside-owner' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[architecture.roles]\nenv = ["Sources/Screen.swift"]\n' }),
    );
    expect(await envOwner(buildCheckInput(await openSession(sandbox.path), 'swift/env-owner'))).toStrictEqual([]);
});
