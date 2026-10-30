import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('grants reports GRANT ALL in both direct and default privileges', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_grants.sql':
            'GRANT ALL ON TABLE orders TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_reader;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/grants');
    expect(findings).toStrictEqual(
        [1, 2].map((line) => ({
            check: 'postgres/grants',
            file: 'migrations/1_grants.sql',
            line,
            column: 1,
            rule: 'grant-all',
            message: 'GRANT ALL gives every privilege, present and future; name the privileges.',
            fixable: false,
            help: 'Name the privileges the role needs, such as `SELECT` alone.',
        })),
    );
});

test('grants in a child scope skip frozen migrations and report the newer ones', async () => {
    await using sandbox = await testdir({
        'app/migrations/V1_before.sql': 'GRANT ALL ON TABLE before_table TO authenticated;\n',
        'app/migrations/V2_at.sql': 'GRANT ALL ON TABLE at_table TO authenticated;\n',
        'app/migrations/V3_after.sql': 'GRANT ALL ON TABLE after_table TO authenticated;\n',
    });
    for (const { through, files } of [
        { through: 'none', files: ['V1_before.sql', 'V2_at.sql', 'V3_after.sql'] },
        { through: '2', files: ['V3_after.sql'] },
        { through: 'all', files: [] },
    ] as const) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['postgres'], {
                level: 'all',
                scopes: [{ path: 'app', configurations: ['postgres'] }],
                tables: `[postgres]\nfrozen_through = "${through}"\n`,
            }),
        );

        const findings = await runSandboxCheck(sandbox.path, 'postgres/grants', { scope: 'app' });
        expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            files.map((name) => ({ file: `app/migrations/${name}`, line: 1, rule: 'grant-all' })),
        );
    }
});
