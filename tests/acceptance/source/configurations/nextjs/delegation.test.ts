// The framework rules stay enforced, and type checking delegates to the Next.js check only when that check runs.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { reportSchema } from '#cli/execution/report.ts';
import type { RunReport } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installedNextProject, NEXT_LAYOUT } from '#tests/support/cli/nextjs.ts';

const OWNER_WRITES = 0o644;

describe('the nextjs and i18n configurations', () => {
    test(
        'framework lint rules remain enforced and typechecking delegates only when its replacement runs',
        async () => {
            const prepared = await installedNextProject();
            await using sandbox = prepared.sandbox;
            const environment = prepared.environment;
            const disabled = await run(
                sandbox.path,
                ['check', '--only', 'nextjs/build', '--no-cache', '--json'],
                environment,
            );
            expect(disabled.code, disabled.stdout + disabled.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(disabled.stdout)).checks).toMatchObject([
                { check: 'nextjs/build', status: 'skipped', note: expect.stringContaining('tools.next.build_in_gate') },
            ]);
            const written = await Bun.file(join(sandbox.path, '.gspot/config/eslint.config.mjs')).text();
            // A later block that turns a required rule off is what integrity/required-rules exists to see.
            const held = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache', '--json'],
                environment,
            );
            expect(held.code, held.stdout + held.stderr).toBe(0);
            chmodSync(join(sandbox.path, '.gspot/config/eslint.config.mjs'), OWNER_WRITES);
            const loosened = written.replace("'react/no-danger': 'error'", "'react/no-danger': 'off'");
            await Bun.write(join(sandbox.path, '.gspot/config/eslint.config.mjs'), loosened);
            const seen = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache', '--json'],
                environment,
            );
            expect(seen.code, seen.stdout + seen.stderr).toBe(1);
            const integrity = reportSchema.parse(JSON.parse(seen.stdout));
            expect(integrity.checks).toMatchObject([{ check: 'integrity/required-rules', status: 'fail' }]);
            expect(integrity.checks[0]!.findings).toContainEqual(
                expect.objectContaining({
                    file: '.gspot/config/eslint.config.mjs',
                    rule: 'rule-off',
                    line: 1,
                    message:
                        'react/no-danger is off for app/layout.tsx, and the configurations require it for every .tsx file.',
                }),
            );
            await Bun.write(join(sandbox.path, '.gspot/config/eslint.config.mjs'), written);
            const restored = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache', '--json'],
                environment,
            );
            expect(restored.code, restored.stdout + restored.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(restored.stdout)).checks).toMatchObject([
                { check: 'integrity/required-rules', status: 'ok', findings: [] },
            ]);
            const direct = await run(
                sandbox.path,
                ['check', '--only', 'typescript/tsc', '--no-cache', '--json'],
                environment,
            );
            expect(direct.code, direct.stdout + direct.stderr).toBe(0);
            expect((JSON.parse(direct.stdout) as RunReport).checks).toMatchObject([
                { check: 'typescript/tsc', status: 'ok' },
            ]);
            const delegated = await run(
                sandbox.path,
                ['check', '--only', 'typescript/tsc', 'nextjs/typecheck', '--no-cache', '--json'],
                environment,
            );
            expect(delegated.code, delegated.stdout + delegated.stderr).toBe(0);
            const delegatedReport = JSON.parse(delegated.stdout) as RunReport;
            expect(delegatedReport.checks.find((check) => check.check === 'nextjs/typecheck')?.status).toBe('ok');
            expect(delegatedReport.checks.find((check) => check.check === 'typescript/tsc')).toMatchObject({
                status: 'skipped',
                note: 'nextjs/typecheck runs it here',
            });
            // Text written into the markup is what the i18n rule exists for, and a rule that runs proves its plugin works.
            const literal = NEXT_LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>');
            await Bun.write(join(sandbox.path, 'app/layout.tsx'), literal);
            const lint = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(lint.code, lint.stdout + lint.stderr).toBe(1);
            const findings = reportSchema.parse(JSON.parse(lint.stdout)).checks[0]!.findings;
            expect(findings).toContainEqual(
                expect.objectContaining({ rule: 'i18next/no-literal-string', file: 'app/layout.tsx', line: 13 }),
            );
            await Bun.write(join(sandbox.path, 'app/layout.tsx'), NEXT_LAYOUT);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(1);
            const remaining = reportSchema.parse(JSON.parse(corrected.stdout));
            expect(remaining.checks).toMatchObject([{ check: 'typescript/eslint', status: 'fail' }]);
            expect(remaining.checks[0]!.findings).toContainEqual(
                expect.objectContaining({ rule: 'gspot/no-trivial-functions', file: 'app/page.tsx', line: 7 }),
            );
            expect(
                remaining.checks[0]!.findings.filter(({ rule }) => rule === 'i18next/no-literal-string'),
            ).toStrictEqual([]);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
