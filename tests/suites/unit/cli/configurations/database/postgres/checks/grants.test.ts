import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('grants reports GRANT ALL in both direct and default privileges', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_grants.sql':
            'GRANT ALL ON TABLE orders TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_reader;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/grants');
    expect(findings).toStrictEqual(
        [1, 2].map((line) => matchFields({ file: 'migrations/1_grants.sql', line, rule: 'grant-all' })),
    );
});

test('grants in a child scope skip frozen migrations and report the newer ones', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['postgres'] }],
            tables: '[postgres]\nfrozen_through = "2"\n',
        }),
        'app/migrations/V1_before.sql': 'GRANT ALL ON TABLE before_table TO authenticated;\n',
        'app/migrations/V2_at.sql': 'GRANT ALL ON TABLE at_table TO authenticated;\n',
        'app/migrations/V3_after.sql': 'GRANT ALL ON TABLE after_table TO authenticated;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/grants', { scope: 'app' });
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'app/migrations/V3_after.sql', line: 1, rule: 'grant-all' },
    ]);
});
