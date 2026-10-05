import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { readTree } from '#tests/harness/preservation.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { INIT_CI_CASES } from '#tests/config/cli/commands/init/ci.ts';

test.each(INIT_CI_CASES)(
    'an explicit CI provider takes precedence over $name and preserves authored jobs',
    async ({ path, content }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: content, 'control.txt': 'preserve this source\n' });
        commitAll(sandbox.path);
        const before = readTree(sandbox.path);
        for (const provider of ['github', 'gitlab'] as const) {
            const preview = await runGspot(sandbox.path, [
                'init',
                '--yes',
                '--dry-run',
                '--json',
                '--configurations',
                'none',
                '--no-task',
                '--no-hooks',
                '--no-rules',
                '--no-install',
                '--ci',
                provider,
            ]);
            expect(preview.code, preview.stdout + preview.stderr).toBe(0);
            expect(preview.stderr).toBe('');
            const report = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan' | 'policy'>>;
            expect(parseStrictPolicy(report.policy).ci?.provider).toBe(provider);
            const workflow = provider === 'github' ? '.github/workflows/gspot.yml' : '.gitlab/ci/gspot.yml';
            expect(report.plan.write).toContainEqual({
                path: workflow,
                note:
                    provider === 'github'
                        ? 'check workflow'
                        : 'add include: [{ local: .gitlab/ci/gspot.yml }] to .gitlab-ci.yml',
            });
            expect(report.plan.retained).toContainEqual({
                path: `${path}: quality`,
                note: 'existing lint job retained; no duplicate CI job proposed',
            });
            expect(readTree(sandbox.path)).toStrictEqual(before);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);
        }
    },
);
