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

test.each(['', 'app'])('grants in scope %j skip frozen migrations and report the newer ones', async (scope) => {
    const prefix = scope === '' ? '' : `${scope}/`;
    await using sandbox = await testdir(
        Object.fromEntries(
            Object.entries({
                'migrations/V1_before.sql': 'GRANT ALL ON TABLE before_table TO authenticated;\n',
                'migrations/V2_at.sql': 'GRANT ALL ON TABLE at_table TO authenticated;\n',
                'migrations/V3_after.sql': 'GRANT ALL ON TABLE after_table TO authenticated;\n',
            } as const).map(([path, text]) => [`${prefix}${path}`, text]),
        ),
    );
    for (const { through, files } of [
        { through: 'none', files: ['migrations/V1_before.sql', 'migrations/V2_at.sql', 'migrations/V3_after.sql'] },
        { through: '2', files: ['migrations/V3_after.sql'] },
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

        const findings = await runSandboxCheck(sandbox.path, 'postgres/grants', { scope });
        expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            files.map((path) => ({ file: `${prefix}${path}`, line: 1, rule: 'grant-all' })),
        );
    }
});
