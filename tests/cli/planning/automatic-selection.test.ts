import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { skipFor } from '#cli/planning/contracts.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy, alwaysSelectedConfigurations } from '#tests/harness/policy.ts';

test.each(['recommended', 'all'] as const)(
    '%s selects general checks from a stored empty manual list without changing policy',
    async (level) => {
        const policy = buildPolicy([], { level });
        await using sandbox = await testdir({
            'gspot.toml': policy,
            'source.js': 'export const port = 8080;\n',
            'guide.md': '# Schedule\n\nRelease on 03/04/2026.\n',
            'app/package.json': '{"name":"app","private":true}',
            'app/source.js': 'export const port = 3000;\n',
        });
        const session = await openSession(sandbox.path);
        expect(session.policyFiles.policy.configurations).toStrictEqual([]);
        const selected = session.scopes.flatMap((scope) =>
            scope.selected.map((manifest) => manifest.configuration.name),
        );
        for (const configuration of [...alwaysSelectedConfigurations(), 'licenses'])
            expect(selected).toContain(configuration);
        expect(selected).not.toContain('javascript');
        expect(selected).not.toContain('markdown');
        const checks = planRun(session, {
            stage: 'all',
            skips: [],
            only: ['security/semgrep', 'prose/vale', 'duplication/jscpd', 'licenses/allowed'],
        });
        const security = checks.find((check) => check.check.name === 'security/semgrep');
        expect(security).toBeDefined();
        expect(security?.files).toStrictEqual([]);
        expect(security?.skip).toStrictEqual({
            cause: 'condition',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        });
        expect(checks.find((check) => check.check.name === 'prose/vale')?.files.map((file) => file.path)).toContain(
            'guide.md',
        );
        expect(checks.some((check) => check.check.name === 'duplication/jscpd')).toBe(level === 'all');
        expect(checks.find((check) => check.check.name === 'licenses/allowed')?.skip).toBeUndefined();
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);

test('an explicitly authored Git configuration reports its repository prerequisite', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['commits'], { level: 'all' }),
        'source.py': 'PORT = 8080\n',
    });
    const planned = planRun(await openSession(sandbox.path), {
        stage: 'push',
        skips: [],
        only: ['commits/commitlint-pushed'],
    });
    expect(planned.map((check) => check.skip)).toStrictEqual([
        { cause: 'condition', note: 'This folder is not a Git repository, so the check has no history to read.' },
    ]);
});

test('a projected policy input respects the repository exclusion before native tool requirements are selected', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy([], { tables: 'exclude = ["gspot.toml"]\n' }),
        'source.txt': 'Authored input.\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.repository.files.map((file) => file.path)).not.toContain('gspot.toml');
    expect(
        planRun(session, { stage: 'commit', skips: [], only: ['files/taplo', 'files/taplo-format'] }).map(
            (check) => check.files,
        ),
    ).toStrictEqual([[], []]);
});

test.each(['secrets/gitleaks-files', 'security/semgrep'])(
    'the Git prerequisite message names the supplied %s check',
    async (name) => {
        await using sandbox = await testdir({ 'gspot.toml': buildPolicy(['secrets', 'javascript']) });
        const session = await openSession(sandbox.path);
        const [planned] = planRun(session, { stage: 'all', skips: [], only: [name] });
        expect(planned).toBeDefined();
        expect(
            skipFor(
                { ...planned!, check: { ...planned!.check, when: { git: false } } },
                { stage: 'all', skips: [] },
                { platform: 'macos', arch: 'arm64' },
                true,
                session.policyFiles.policy,
                [],
            ),
        ).toStrictEqual({ cause: 'condition', note: `The ${name} check scans the files of this Git repository.` });
    },
);
