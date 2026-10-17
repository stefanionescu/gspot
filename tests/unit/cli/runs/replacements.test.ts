import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { TSC_REPLACEMENTS } from '#tests/data/runs/plan.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';

test.each([...TSC_REPLACEMENTS])(
    '$check replaces typescript/tsc only while it runs',
    async ({ configuration, check, source, text }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['typescript', configuration]),
            'source.ts': 'export const port = 8080;\n',
            [source]: text,
        });
        const session = await openSession(sandbox.path);
        const options = { stage: 'all' as const, only: ['typescript/tsc', check] };
        expect(
            planRun(session, options).find(({ check: entry }) => entry.name === 'typescript/tsc')?.skip,
        ).toStrictEqual({
            cause: 'replaced',
            note: `${check} runs it here`,
        });
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildSettingsText(['typescript', configuration], {
                tables: `[[ignore]]
check = ${JSON.stringify(check)}
reason = "The separate compiler checks this source."
`,
            }),
        );
        const ignored = await openSession(sandbox.path);
        expect(
            planRun(ignored, options).find(({ check: entry }) => entry.name === 'typescript/tsc')?.skip,
        ).toBeUndefined();
        expect(
            planRun(session, { ...options, only: ['typescript/tsc'] }).find(
                ({ check: entry }) => entry.name === 'typescript/tsc',
            )?.skip,
        ).toBeUndefined();
    },
);

test('a nested Next.js check replaces TypeScript only in its own scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript'], {
            tables: '[[scope]]\npath = "app"\nconfigurations = ["typescript", "nextjs"]',
        }),
        'source.ts': 'export const port = 8080;\n',
        'app/source.ts': 'export const port = 3000;\n',
    });
    const session = await openSession(sandbox.path);
    const configured = session.configuredChecks
        .filter((entry) => ['typescript/tsc', 'nextjs/tsc'].includes(entry.check.name))
        .map((entry) => [entry.selection.scope.path, entry.check.name]);
    expect(configured).toStrictEqual([
        ['', 'typescript/tsc'],
        ['app', 'nextjs/tsc'],
    ]);
});
