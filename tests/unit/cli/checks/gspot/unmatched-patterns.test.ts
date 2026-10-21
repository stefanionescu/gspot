import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { UNUSED_PATH_CASES } from '#tests/data/checks/gspot/unmatched-patterns.ts';

test.each([...UNUSED_PATH_CASES])(
    'gspot/unmatched-patterns reports only paths without tracked matches: $name',
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
        const findings = await checkFindings(sandbox.path, 'gspot/unmatched-patterns');
        expect(findings.map((finding) => finding.message.split(' under ', 1)[0])).toStrictEqual([...unmatched]);
        expect(findings).toMatchObject(
            unmatched.map(() => ({
                check: 'gspot/unmatched-patterns',
                file: 'gspot.toml',
                line: 1,
                rule: 'unused-record',
            })),
        );
    },
);
