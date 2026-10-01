// Policy choices the nextjs configuration follows: the re-export mode, the compiler replacement, and locale checking.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { ReplacePlan } from '#cli/types/commands.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { linkInstalledModules } from '#tests/support/cli/platforms.ts';

test.each(['none', 'index-only'])(
    'Next.js entry files preserve the re-export policy in %s mode',
    async (mode) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['nextjs'], `[structure]\nreexports = "${mode}"\n`, 'all'),
            'package.json':
                '{"name":"next-reexports","private":true,"type":"module","dependencies":{"react":"19.1.1","next":"16.3.5"}}',
            'tsconfig.json':
                '{ "compilerOptions": { "strict": true, "jsx": "preserve" }, "include": ["app/**/*.ts"] }\n',
            'app/value.ts': 'export const value = 1;\n',
            'app/page.ts': 'export { value } from "./value.ts";\n',
            'app/forward.ts': 'export { value } from "./value.ts";\n',
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const outcome = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        const findings = report.checks
            .flatMap((check) => check.findings)
            .filter((finding) => finding.rule === 'gspot/no-reexports');
        expect(findings.map(({ file, line }) => ({ file, line }))).toStrictEqual(
            mode === 'none'
                ? [
                      { file: 'app/forward.ts', line: 1 },
                      { file: 'app/page.ts', line: 1 },
                  ]
                : [{ file: 'app/forward.ts', line: 1 }],
        );
        for (const path of ['app/value.ts', 'app/page.ts', 'app/forward.ts'])
            await Bun.write(
                join(sandbox.path, path),
                '// Values owned by this module.\n\n/** The displayed value. */\nexport const value = 1;\n',
            );
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'typescript/eslint', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

// One way of leaving the Next.js check out is enough: --only and [[ignore]] reach the same skip.
test(
    'the TypeScript check still finds defects when its replacement is skipped',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['nextjs'], '[guides]\ninstall = false\n'),
            'package.json':
                '{"name":"compiler-selection","private":true,"type":"module","dependencies":{"next":"16.3.5"}}',
            'tsconfig.json': '{"compilerOptions":{"types":[],"skipLibCheck":true},"include":["src"]}',
            'src/count.ts': 'export const count: number = "wrong";\n',
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const args = ['check', '--only', 'typescript/tsc', 'nextjs/typecheck', '--skip', 'nextjs/typecheck'];
        const failed = await run(sandbox.path, [...args, '--no-cache', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.find((check) => check.check === 'typescript/tsc')).toMatchObject({
            status: 'fail',
            findings: [{ check: 'typescript/tsc', file: 'src/count.ts', rule: 'TS2322', line: 1, column: 14 }],
        });
        expect(report.skips.some((skip) => skip.check === 'nextjs/typecheck' && skip.source === 'flag')).toBe(true);
        writeFileSync(join(sandbox.path, 'src/count.ts'), 'export const count: number = 3;\n');
        const corrected = await run(sandbox.path, [...args, '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 4,
);

test.each([
    { dependency: false, excluded: false, named: false, selected: false },
    { dependency: true, excluded: false, named: false, selected: true },
    { dependency: true, excluded: true, named: false, selected: false },
    { dependency: false, excluded: false, named: true, selected: true },
])(
    'Next.js selects locale checking according to dependencies and explicit choices: %j',
    async ({ dependency, excluded, named, selected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': JSON.stringify({
                name: 'translated-app',
                private: true,
                dependencies: { next: '16.3.5', ...(dependency ? { 'next-intl': '4.3.9' } : {}) },
            }),
            'app/page.tsx': 'export default function Page() { return "home"; }\n',
        });
        const result = await run(sandbox.path, [
            'init',
            '--yes',
            '--dry-run',
            '--json',
            '--kits',
            'nextjs',
            ...(named ? ['i18n'] : []),
            '--without',
            'naming',
            'spelling',
            ...(excluded ? ['i18n'] : []),
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as { plan: ReplacePlan };
        expect(plan.kits.some(({ kit }) => kit === 'i18n')).toBe(selected);
    },
);
