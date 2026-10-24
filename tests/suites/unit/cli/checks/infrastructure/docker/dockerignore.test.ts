import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    DOCKERIGNORE_CASES,
    DOCKERIGNORE_ALLOWLISTS,
} from '#tests/config/checks/infrastructure/docker/dockerignore.ts';

test.each([...DOCKERIGNORE_ALLOWLISTS])(
    'docker/dockerignore respects ordered allowlist $text',
    async ({ text, missing }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker']),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': text,
        });
        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual(
            missing.length === 0
                ? []
                : [
                      {
                          file: '.dockerignore',
                          rule: 'missing-entry',
                          message: `Add these entries to .dockerignore: ${missing.join(', ')}.`,
                      },
                  ],
        );
    },
);

test.each([...DOCKERIGNORE_CASES])(
    `docker/dockerignore requires an ignore file with the entries of each scope's configurations: $name`,
    async ({ files, findings: expectedFindings }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['docker'], { level: 'all' }),
            ...files,
        });

        const findings = await runSandboxCheck(sandbox.path, 'docker/dockerignore');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
            ...expectedFindings,
        ]);
    },
);
