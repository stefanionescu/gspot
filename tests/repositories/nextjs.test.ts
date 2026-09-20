import { createFixture } from 'fs-fixture';
// Planted repository for the nextjs and i18n presets: a segment that serves two things, a build check turned off, versions apart, and message files with holes.
import { delimiter, join } from 'node:path';
import type { PlantedCase } from '#types/run.ts';
import { chmodSync, symlinkSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const OWNER_WRITES = 0o644;
const MODULES = join(import.meta.dir, '../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'nextjs,i18n',
    '--without',
    'naming,spelling,css,config-files',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
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
const TRANSLATIONS = '[tools.next]\ntranslations = {directory = "messages", base = "en"}\n';

const CASES: PlantedCase[] = [
    {
        id: 'integrity/route-segments',
        files: {
            'app/route.ts':
                '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n',
        },
        expected: 'holds a page and a route handler',
    },
    {
        id: 'integrity/next-config',
        files: {
            'next.config.mjs':
                '// The framework configuration.\nconst config = { eslint: { ignoreDuringBuilds: true } };\n\nexport default config;\n',
        },
        expected: 'ignoreDuringBuilds lets a build pass',
    },
    {
        id: 'integrity/dependency-alignment',
        files: { 'package.json': manifest('18.3.1') },
        expected: 'react is 19.1.1 and react-dom is 18.3.1',
    },
    {
        id: 'nextjs/typecheck',
        files: {
            'app/count.ts':
                '// A planted file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n',
        },
        expected: 'TS2322',
    },
    {
        id: 'nextjs/build',
        files: { 'app/page.tsx': PAGE.replace('return "home";', 'return missing;') },
        // Turbopack refuses the linked node_modules folder of a planted repository, so the fixture builds with webpack.
        policy: '[tools.next]\nbuild_in_gate = true\nbuild_flags = ["--webpack"]\n',
        expected: 'next build failed',
    },
    {
        id: 'integrity/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start" }\n}\n' },
        policy: TRANSLATIONS,
        expected: 'The key home.greeting of en has no message here',
    },
    {
        id: 'integrity/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name" }\n}\n' },
        policy: TRANSLATIONS,
        expected: 'home.greeting: The message does not parse',
    },
];

describe('the nextjs and i18n presets', () => {
    test(
        'the file checks fire on their planted defects, and the one ESLint configuration holds the framework rules',
        async () => {
            await using fixture = await createFixture({
                '.gitignore': 'node_modules\n.next\n',
                'package.json': manifest('19.1.1'),
                'tsconfig.json': '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["app"]\n}\n',
                'next.config.mjs': CONFIG,
                'app/page.tsx': PAGE,
                'app/layout.tsx': LAYOUT,
                'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
                'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = await runPlanted(fixture.path, { ...planted, files: {} }, environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            const written = await Bun.file(join(fixture.path, '.gspot/eslint.config.mjs')).text();
            expect(written).toContain("nextPlugin.configs['core-web-vitals']");
            expect(written).toContain('i18next/no-literal-string');
            // A later block that turns a required rule off is what integrity/required-rules exists to see.
            const held = run(fixture.path, ['check', 'integrity/required-rules', '--no-cache'], environment);
            expect(held.code, held.stdout + held.stderr).toBe(0);
            chmodSync(join(fixture.path, '.gspot/eslint.config.mjs'), OWNER_WRITES);
            const loosened = written.replace("'react/no-danger': 'error'", "'react/no-danger': 'off'");
            await Bun.write(join(fixture.path, '.gspot/eslint.config.mjs'), loosened);
            const seen = run(fixture.path, ['check', 'integrity/required-rules', '--no-cache'], environment);
            expect(seen.code, seen.stdout + seen.stderr).toBe(1);
            expect(seen.stdout).toContain('react/no-danger is off for app/layout.tsx');
            await Bun.write(join(fixture.path, '.gspot/eslint.config.mjs'), written);
            const yielded = run(fixture.path, ['check', 'typescript/tsc', '--no-cache'], environment);
            expect(yielded.stdout).toContain('nextjs/typecheck runs it here');
            // Text written into the markup is what the i18n rule exists for, and a rule that runs proves its plugin works.
            const literal = LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>');
            await Bun.write(join(fixture.path, 'app/layout.tsx'), literal);
            const lint = run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(lint.stdout + lint.stderr).not.toContain('broke');
            expect(lint.stdout).toContain('i18next/no-literal-string');
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
