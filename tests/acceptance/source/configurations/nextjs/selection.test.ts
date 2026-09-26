// Policy choices the nextjs configuration follows: the re-export mode, the compiler replacement, and locale checking.
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { symlinkSync, writeFileSync } from 'node:fs';
import { reportSchema } from '#cli/execution/report.ts';
import type { RunReport } from '#cli/execution/report.ts';
import type { TakeoverPlan } from '#cli/commands/init/plan.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

test.each(['none', 'index-only'])(
    'Next.js entry files preserve the re-export policy in %s mode',
    async (mode) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "all"\nconfigurations = ["nextjs"]\n[structure]\nreexports = "${mode}"\n`,
            'package.json':
                '{"name":"next-reexports","private":true,"type":"module","dependencies":{"react":"19.1.1","next":"16.3.5"}}',
            'tsconfig.json':
                '{ "compilerOptions": { "strict": true, "jsx": "preserve" }, "include": ["app/**/*.ts"] }\n',
            'app/value.ts': 'export const value = 1;\n',
            'app/page.ts': 'export { value } from "./value.ts";\n',
            'app/forward.ts': 'export { value } from "./value.ts";\n',
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

test.each(['only', 'ignore', 'flag'])(
    'the TypeScript check still finds defects when its replacement is absent through %s',
    async (selection) => {
        await using sandbox = await testdir();
        const policy = 'version = 1\nconfigurations = ["nextjs"]\n[rules]\ninstall = false\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policy + (selection === 'ignore' ? '\n[[ignore]]\ncheck = "nextjs/typecheck"\n' : ''),
            'package.json':
                '{"name":"compiler-selection","private":true,"type":"module","dependencies":{"next":"16.3.5"}}',
            'tsconfig.json': '{"compilerOptions":{"types":[],"skipLibCheck":true},"include":["src"]}',
            'src/count.ts': 'export const count: number = "wrong";\n',
        });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const args = [
            'check',
            '--only',
            'typescript/tsc',
            ...(selection === 'only' ? [] : ['nextjs/typecheck']),
            ...(selection === 'flag' ? ['--skip', 'nextjs/typecheck'] : []),
            '--no-cache',
            '--json',
        ];
        const failed = await run(sandbox.path, args);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.find((check) => check.check === 'typescript/tsc')).toMatchObject({
            status: 'fail',
            findings: [{ check: 'typescript/tsc', file: 'src/count.ts', rule: 'TS2322', line: 1, column: 14 }],
        });
        // The Next.js type check is skipped for the reason the selection gives, and not when it runs alone.
        expect(report.skips.some((skip) => skip.check === 'nextjs/typecheck' && skip.source === selection)).toBe(
            selection !== 'only',
        );
        writeFileSync(join(sandbox.path, 'src/count.ts'), 'export const count: number = 3;\n');
        const corrected = await run(sandbox.path, args);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS * 2,
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
            '--configurations',
            'nextjs',
            ...(named ? ['i18n'] : []),
            '--without',
            'naming',
            'spelling',
            ...(excluded ? ['i18n'] : []),
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as { plan: TakeoverPlan };
        expect(plan.configurations.some(({ configuration }) => configuration === 'i18n')).toBe(selected);
    },
);
