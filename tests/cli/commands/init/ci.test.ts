import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { initCommand } from '#cli/commands/init/public.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { askQuestions } from '#cli/commands/init/contracts.ts';
import { EMPTY_TOOLING } from '#tests/config/harness/tooling.ts';
import { buildInitOptions, buildInitArguments } from '#tests/harness/init.ts';
import { INIT_CI_CASES, CI_PREFERENCE_CASES } from '#tests/config/cli/commands/init/ci.ts';

test.each(INIT_CI_CASES)(
    'an explicit CI provider takes precedence over $name and preserves authored jobs',
    async ({ path, content }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [path]: content, 'control.txt': 'preserve this source\n' });
        commitAll(sandbox.path);
        const before = await readTree(sandbox.path);
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
                '--no-agent-rules',
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
            expect(await readTree(sandbox.path)).toStrictEqual(before);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(content);
        }
    },
);

test('initialization distinguishes retained CI jobs from tool settings that generated configuration replaces', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'setup.cfg': '[flake8]\nignore = E501\n[sqlfluff]\nexclude_rules = LT01\n',
        '.gitlab-ci.yml': 'quality:\n  script: npm run lint\n',
        'query.sql': 'SELECT 1;\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...buildInitArguments(['sql']), '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const retained = preview.stdout.split('left in place\n', 2)[1]?.split('\n\n', 1)[0];
    expect(retained).toContain('setup.cfg');
    expect(retained).toContain('generated sqlfluff configuration takes over');
    expect(retained).toContain('.gitlab-ci.yml: quality');
    expect(retained).toContain('existing lint job retained; no duplicate CI job proposed');
    expect(preview.stdout).not.toContain('kept active');
    expect(preview.stdout).not.toContain('left in place, no longer read');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const empty = await runGspot(sandbox.path, [...buildInitArguments(['none']), '--dry-run']);
    expect(empty.code, empty.stdout + empty.stderr).toBe(0);
    expect(empty.stdout).toMatch(/^ {2}security\s+detected\s/mu);
    expect(empty.stdout).not.toMatch(/^ {2}sql\s+/mu);
    expect(empty.stdout).not.toContain('the rules install alone');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(CI_PREFERENCE_CASES)('initialization CI preference uses %s', async (_label, ci, path, remote, expected) => {
    await using sandbox = await testdir();
    if (path !== '') await createFileTree(sandbox.path, { [path]: '{}\n' });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['config', 'remote.origin.url', remote]);
    const options = buildInitOptions(sandbox.path, { isDryRun: true });
    delete options.ci;
    const answers = await askQuestions(sandbox.path, options, { ...EMPTY_TOOLING, ci: [...ci] });
    expect(answers).toStrictEqual({ hooks: false, runner: 'none', agentRules: false, ci: expected });
});

test('init keeps an unsupported CI pipeline in place and names it in the plan', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'bitbucket-pipelines.yml': '{}\n' });
    const before = await readTree(sandbox.path);
    const result = await initCommand(buildInitOptions(sandbox.path, { isDryRun: true, configurations: ['none'] }));
    expect(result.exitCode, result.text).toBe(0);
    const { plan } = result.json as Required<Pick<InitJson, 'plan'>>;
    expect(plan.retained.map((entry) => entry.path)).toStrictEqual(['bitbucket-pipelines.yml']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
