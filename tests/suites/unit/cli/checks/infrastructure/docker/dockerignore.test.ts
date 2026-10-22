import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOCKERIGNORE_CASES } from '#tests/config/checks/infrastructure/docker/dockerignore.ts';

test.each([...DOCKERIGNORE_CASES])(
    `docker/dockerignore requires an ignore file with the entries of each scope's configurations: $name`,
    async ({ files, findings: expectedFindings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker'], { level: 'all' }),
            ...files,
        });

        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        expect(
            findings.map(({ file, rule, message }) => ({
                file,
                rule,
                message,
            })),
        ).toStrictEqual([...expectedFindings]);
    },
);
