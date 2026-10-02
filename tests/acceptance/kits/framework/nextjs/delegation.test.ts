// The framework rules stay enforced, and type checking delegates to the Next.js check only when that check runs.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { run } from '#tests/harness/cli/command.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installedNextProject } from '#tests/harness/cli/nextjs.ts';
import { NEXT_LAYOUT, PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { OWNER_WRITES } from '#tests/inputs/acceptance/source/kits/nextjs.ts';

test(
    'Next.js framework rules reject a disabled requirement and accept its restoration',
    async () => {
        const prepared = await installedNextProject();
        await using sandbox = prepared.sandbox;
        const environment = prepared.environment;
        const written = await Bun.file(join(sandbox.path, '.gspot/config/eslint.config.mjs')).text();
        // A later block that turns a required rule off is what integrity/required-rules exists to see.
        const held = await run(sandbox.path, ['check', '--only', 'integrity/required-rules', '--json'], environment);
        expect(held.code, held.stdout + held.stderr).toBe(0);
        chmodSync(join(sandbox.path, '.gspot/config/eslint.config.mjs'), OWNER_WRITES);
        const loosened = written.replace("'react/no-danger': 'error'", "'react/no-danger': 'off'");
        await Bun.write(join(sandbox.path, '.gspot/config/eslint.config.mjs'), loosened);
        const seen = await run(sandbox.path, ['check', '--only', 'integrity/required-rules', '--json'], environment);
        expect(seen.code, seen.stdout + seen.stderr).toBe(1);
        const integrity = JSON.parse(seen.stdout) as RunReport;
        expect(integrity.checks).toMatchObject([{ check: 'integrity/required-rules', status: 'fail' }]);
        expect(integrity.checks[0]!.findings).toContainEqual(
            containing({
                file: '.gspot/config/eslint.config.mjs',
                rule: 'rule-off',
                line: 1,
                message:
                    'react/no-danger is off for app/layout.tsx, and the configurations require it for every .tsx file.',
            }),
        );
        await Bun.write(join(sandbox.path, '.gspot/config/eslint.config.mjs'), written);
        const requiredRules = await run(
            sandbox.path,
            ['check', '--only', 'integrity/required-rules', '--json'],
            environment,
        );
        expect(requiredRules.code, requiredRules.stdout + requiredRules.stderr).toBe(0);
        expect((JSON.parse(requiredRules.stdout) as RunReport).checks).toMatchObject([
            { check: 'integrity/required-rules', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 6,
);
test(
    'Next.js type checking delegates only when its replacement runs',
    async () => {
        const prepared = await installedNextProject();
        await using sandbox = prepared.sandbox;
        const environment = prepared.environment;
        const disabled = await run(sandbox.path, ['check', '--only', 'nextjs/build', '--json'], environment);
        expect(disabled.code, disabled.stdout + disabled.stderr).toBe(0);
        expect((JSON.parse(disabled.stdout) as RunReport).checks).toMatchObject([
            { check: 'nextjs/build', status: 'skipped', note: textContaining('tools.next.build_in_gate') },
        ]);
        const direct = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json'], environment);
        expect(direct.code, direct.stdout + direct.stderr).toBe(0);
        expect((JSON.parse(direct.stdout) as RunReport).checks).toMatchObject([
            { check: 'typescript/tsc', status: 'ok' },
        ]);
        const delegated = await run(
            sandbox.path,
            ['check', '--only', 'typescript/tsc', 'nextjs/typecheck', '--json'],
            environment,
        );
        expect(delegated.code, delegated.stdout + delegated.stderr).toBe(0);
        const delegatedReport = JSON.parse(delegated.stdout) as RunReport;
        expect(delegatedReport.checks.find((check) => check.check === 'nextjs/typecheck')?.status).toBe('ok');
        expect(delegatedReport.checks.find((check) => check.check === 'typescript/tsc')).toMatchObject({
            status: 'skipped',
            note: 'nextjs/typecheck runs it here',
        });
    },
    PLANTED_TIMEOUT_MS * 6,
);
test(
    'Next.js i18n rules reject literal markup and retain independent structural findings after correction',
    async () => {
        const prepared = await installedNextProject();
        await using sandbox = prepared.sandbox;
        const environment = prepared.environment;
        // Text written into the markup is what the i18n rule exists for, and a rule that runs proves its plugin works.
        const literal = NEXT_LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>');
        await Bun.write(join(sandbox.path, 'app/layout.tsx'), literal);
        const lint = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--json'], environment);
        expect(lint.code, lint.stdout + lint.stderr).toBe(1);
        const findings = (JSON.parse(lint.stdout) as RunReport).checks[0]!.findings;
        expect(findings).toContainEqual(
            containing({ rule: 'i18next/no-literal-string', file: 'app/layout.tsx', line: 13 }),
        );
        await Bun.write(join(sandbox.path, 'app/layout.tsx'), NEXT_LAYOUT);
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(1);
        const remaining = JSON.parse(corrected.stdout) as RunReport;
        expect(remaining.checks).toMatchObject([{ check: 'typescript/eslint', status: 'fail' }]);
        expect(remaining.checks[0]!.findings).toContainEqual(
            containing({ rule: 'gspot/no-trivial-functions', file: 'app/page.tsx', line: 7 }),
        );
        expect(remaining.checks[0]!.findings.filter(({ rule }) => rule === 'i18next/no-literal-string')).toStrictEqual(
            [],
        );
    },
    PLANTED_TIMEOUT_MS * 6,
);
