import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { UNMATCHED_PATH_CASES } from '#tests/data/checks/gspot/unmatched-paths.ts';

test.each([...UNMATCHED_PATH_CASES])(
    'gspot/unmatched-paths reports each setting path without a tracked match: $name',
    async ({ files, settings, unmatched }) => {
        await using sandbox = await testdir();
        const { configurations, ...tables } = settings;
        await createFileTree(sandbox.path, {
            ...files,
            'gspot.toml': buildSandboxSettings(configurations, {
                level: 'all',
                rules: true,
                tables: stringify(tables),
            }),
        });
        commitAll(sandbox.path);
        const findings = await checkFindings(sandbox.path, 'gspot/unmatched-paths');
        expect(findings.map((finding) => finding.message.split(' under ', 1)[0])).toStrictEqual([...unmatched]);
        expect(findings).toMatchObject(
            unmatched.map(() => ({
                check: 'gspot/unmatched-paths',
                file: 'gspot.toml',
                line: 1,
                rule: 'unmatched-path',
            })),
        );
    },
);
