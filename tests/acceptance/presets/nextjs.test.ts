import { randomUUID } from 'node:crypto';
// Planted repository for the nextjs and i18n presets: a segment that serves two things, a build check turned off, versions apart, and message files with holes.
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { chmodSync, symlinkSync, writeFileSync } from 'node:fs';
import type { TakeoverPlan } from '#cli/lifecycle/types.ts';
import type { RunReport } from '#cli/output/report-types.ts';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import {
    installPrivateTools,
    commitAll,
    install,
    PLANTED_TIMEOUT_MS,
    run,
    runPlanted,
    toolsPath,
} from '#tests/support/cli/planted.ts';

const OWNER_WRITES = 0o644;
const MODULES = join(import.meta.dir, '../../../node_modules');

test.each(['none', 'index-only'])(
    'Next.js entry files preserve the re-export policy in %s mode',
    async (mode) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "all"\npresets = ["nextjs"]\n[structure]\nreexports = "${mode}"\n`,
            'package.json':
                '{"name":"next-reexports","private":true,"type":"module","dependencies":{"react":"19.1.1","next":"16.3.5"}}',
            'tsconfig.json':
                '{ "compilerOptions": { "strict": true, "jsx": "preserve" }, "include": ["app/**/*.ts"] }\n',
            'app/value.ts': 'export const value = 1;\n',
            'app/page.ts': 'export { value } from "./value.ts";\n',
            'app/forward.ts': 'export { value } from "./value.ts";\n',
        });
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const outcome = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        const findings = report.checks
            .flatMap((check) => check.findings)
            .filter((finding) => finding.rule === 'gspot/no-reexports');
        expect(findings.map(({ file, line }) => ({ file, line }))).toEqual(
            mode === 'none'
                ? [
                      { file: 'app/forward.ts', line: 1 },
                      { file: 'app/page.ts', line: 1 },
                  ]
                : [{ file: 'app/forward.ts', line: 1 }],
        );
    },
    PLANTED_TIMEOUT_MS,
);

const INIT = [
    'init',
    '--yes',
    '--presets',
    'nextjs',
    '--without',
    'naming',
    'spelling',
    'css',
    'configs',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const manifest = (reactDom: string): string =>
    `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "16.3.5",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "${reactDom}"\n    }\n}\n`;
const CONFIG = '// The framework configuration.\nconst config = { reactStrictMode: true };\n\nexport default config;\n';
const PAGE =
    '// The home page.\n\n/**\n * Renders the home page.\n * @returns the page\n */\nexport default function Page(): string {\n    return "home";\n}\n';
const LAYOUT =
    '// The root layout.\nimport type { ReactNode } from \'react\';\n\n/**\n * Wraps every page.\n * @param props the children\n * @param props.children the page\n * @returns the document\n */\nexport default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {\n    return (\n        <html lang="en">\n            <body>{children}</body>\n        </html>\n    );\n}\n';
const TRANSLATIONS = '[tools.i18n]\ntranslations = {directory = "messages", base = "en"}\n';

const CASES: PlantedCase[] = [
    {
        check: 'integrity/route-segments',
        files: {
            'app/route.ts':
                '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n',
        },
        expected: 'holds a page and a route handler',
    },
    {
        check: 'integrity/next-config',
        files: {
            'next.config.mjs':
                '// The framework configuration.\nconst config = { eslint: { ignoreDuringBuilds: true } };\n\nexport default config;\n',
        },
        expected: 'ignoreDuringBuilds lets a build pass',
    },
    {
        check: 'integrity/dependency-alignment',
        files: { 'package.json': manifest('18.3.1') },
        expected: 'react is 19.1.1 and react-dom is 18.3.1',
    },
    {
        check: 'nextjs/typecheck',
        files: {
            'app/count.ts':
                '// A planted file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n',
        },
        expected: 'TS2322',
    },
    {
        check: 'nextjs/build',
        files: { 'app/page.tsx': PAGE.replace('return "home";', 'return missing;') },
        // Turbopack refuses the linked node_modules folder of a planted repository, so the sandbox builds with webpack.
        policy: '[tools.next]\nbuild_in_gate = true\nbuild_flags = ["--webpack"]\n',
        expected: 'next build failed',
    },
    {
        check: 'i18n/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start" }\n}\n' },
        policy: TRANSLATIONS,
        expected: 'The key home.greeting of en has no message here',
    },
    {
        check: 'i18n/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name" }\n}\n' },
        policy: TRANSLATIONS,
        expected: 'home.greeting: The message does not parse',
    },
];

describe('the nextjs and i18n presets', () => {
    test(
        'the file checks fire on their planted defects, and the one ESLint configuration holds the framework rules',
        async () => {
            // Webpack requires the linked dependencies and the sandbox to share a drive.
            await using sandbox = await testdir(
                {},
                { dirname: join(join(MODULES, '../..'), 'gspot-test-' + randomUUID()) },
            );
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n.next\n',
                'package.json': manifest('19.1.1'),
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "DOM.Iterable", "ES2022"],\n        "noEmit": true,\n        "plugins": [{ "name": "next" }]\n    },\n    "include": ["app"]\n}\n',
                'next.config.mjs': CONFIG,
                'app/page.tsx': PAGE,
                'app/layout.tsx': LAYOUT,
                'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
                'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const disabled = await run(sandbox.path, ['check', '--only', 'nextjs/build', '--no-cache'], environment);
            expect(disabled.code, disabled.stdout + disabled.stderr).toBe(0);
            expect(disabled.stdout).toContain('skipped');
            expect(disabled.stdout).toContain('tools.next.build_in_gate');
            for (const planted of CASES) {
                const clean = await runPlanted(sandbox.path, { ...planted, files: {} }, environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const written = await Bun.file(join(sandbox.path, '.gspot/eslint.config.mjs')).text();
            expect(written).toContain("nextPlugin.configs['core-web-vitals']");
            expect(written).toContain('i18next/no-literal-string');
            // A later block that turns a required rule off is what integrity/required-rules exists to see.
            const held = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache'],
                environment,
            );
            expect(held.code, held.stdout + held.stderr).toBe(0);
            chmodSync(join(sandbox.path, '.gspot/eslint.config.mjs'), OWNER_WRITES);
            const loosened = written.replace("'react/no-danger': 'error'", "'react/no-danger': 'off'");
            await Bun.write(join(sandbox.path, '.gspot/eslint.config.mjs'), loosened);
            const seen = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache'],
                environment,
            );
            expect(seen.code, seen.stdout + seen.stderr).toBe(1);
            expect(seen.stdout).toContain('react/no-danger is off for app/layout.tsx');
            await Bun.write(join(sandbox.path, '.gspot/eslint.config.mjs'), written);
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
            const literal = LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>');
            await Bun.write(join(sandbox.path, 'app/layout.tsx'), literal);
            const lint = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(lint.stdout + lint.stderr).not.toContain('broke');
            expect(lint.stdout).toContain('i18next/no-literal-string');
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});

test.each(['only', 'ignore', 'flag'])(
    'the TypeScript check still finds defects when its replacement is absent through %s',
    async (selection) => {
        await using sandbox = await testdir();
        const policy = 'version = 1\npresets = ["nextjs"]\n[rules]\ninstall = false\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policy + (selection === 'ignore' ? '\n[[ignore]]\ncheck = "nextjs/typecheck"\n' : ''),
            'package.json':
                '{"name":"compiler-selection","private":true,"type":"module","dependencies":{"next":"16.3.5"}}',
            'tsconfig.json': '{"compilerOptions":{"types":[],"skipLibCheck":true},"include":["src"]}',
            'src/count.ts': 'export const count: number = "wrong";\n',
        });
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'), 'dir');
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
        if (selection !== 'only') expect(report.skips).toContainEqual({ check: 'nextjs/typecheck', source: selection });
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
            '--presets',
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
        expect(plan.presets.some(({ preset }) => preset === 'i18n')).toBe(selected);
    },
);
