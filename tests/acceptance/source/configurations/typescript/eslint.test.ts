// Source CLI journeys for the TypeScript ESLint rules the generated configuration enables.
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { symlinkSync, writeFileSync } from 'node:fs';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';

test(
    'generated TypeScript configuration reports an interface once through the pinned replacement rule',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["typescript"]\n',
            'package.json': '{"name":"interface-check","private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/order.ts': 'export interface Order { total: number }\n',
        });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const outcome = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        const findings = report.checks
            .flatMap((check) => check.findings)
            .filter(
                (finding) =>
                    finding.rule === '@typescript-eslint/consistent-type-definitions' ||
                    finding.rule === 'gspot/types-placement',
            );
        expect(
            findings.map(({ check, file, line, column, rule }) => ({ check, file, line, column, rule })),
        ).toStrictEqual([
            {
                check: 'typescript/eslint',
                file: 'src/order.ts',
                line: 1,
                column: 18,
                rule: '@typescript-eslint/consistent-type-definitions',
            },
        ]);
        await Bun.write(
            join(sandbox.path, 'src/order.ts'),
            '// The shape of a priced order.\n\n/** A total owned by one order. */\nexport type Order = { total: number };\n',
        );
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const after = reportSchema.parse(JSON.parse(corrected.stdout));
        expect(after.checks).toMatchObject([{ check: 'typescript/eslint', status: 'ok', findings: [] }]);
    },
    PLANTED_TIMEOUT_MS,
);

test.each([
    ['star exports', 'export * from "./first.js";\nexport * from "./second.js";\n'],
    ['a local declaration', 'export { shared } from "./first.js";\nexport const shared = 3;\n'],
    ['nested star exports', 'export * from "./bridge/index.js";\nexport { shared } from "./first.js";\n'],
])(
    'generated index-only policy reports duplicate names from %s',
    async (_scenario, barrel) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["typescript"]\n[structure]\nreexports = "index-only"\n',
            'package.json': '{"name":"barrel-check","private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/first.ts': 'export const shared = 1;\n',
            'src/second.ts': 'export const shared = 2;\n',
            'src/index.ts': barrel,
            'src/bridge/index.ts': 'export * from "../first.js";\n',
            'src/forward.ts': 'export { shared } from "./first.ts";\n',
        });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const outcome = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        expect(findings.filter((finding) => finding.rule === 'gspot/no-reexports')).toMatchObject([
            { check: 'typescript/eslint', file: 'src/forward.ts', line: 1, column: 1 },
        ]);
        expect(findings.filter((finding) => finding.rule === 'import-x/export')).toMatchObject([
            { check: 'typescript/eslint', file: 'src/index.ts', line: 1 },
            { check: 'typescript/eslint', file: 'src/index.ts', line: 2 },
        ]);
        writeFileSync(
            join(sandbox.path, 'src/index.ts'),
            'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
        );
        writeFileSync(join(sandbox.path, 'src/forward.ts'), 'export const shared = 1;\n');
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        const correctedReport = JSON.parse(corrected.stdout) as RunReport;
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(1);
        expect(correctedReport.checks).toMatchObject([{ check: 'typescript/eslint', status: 'fail' }]);
        expect(correctedReport.checks[0]!.findings).toContainEqual(
            containing({ rule: 'gspot/no-trivial-files', file: 'src/index.ts', line: 1 }),
        );
        expect(
            correctedReport.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'gspot/no-reexports' || finding.rule === 'import-x/export'),
        ).toStrictEqual([]);
    },
    PLANTED_TIMEOUT_MS,
);
