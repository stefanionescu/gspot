// Planted repository for the nextjs and i18n presets: a segment that serves two things, a build check turned off, versions apart, and message files with holes.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

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
    `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "15.5.4",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "${reactDom}"\n    }\n}\n`;
const CONFIG = '// The framework configuration.\nconst config = { reactStrictMode: true };\n\nexport default config;\n';
const PAGE =
    '// The home page.\n\n/**\n * Renders the home page.\n * @returns the page\n */\nexport default function Page(): string {\n    return "home";\n}\n';
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
                'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
                'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = { PATH: `${MODULES}/.bin:${toolsPath(['typos', 'ec', 'ast-grep'])}` };
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
            const lint = run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(lint.stdout + lint.stderr).not.toContain('broke');
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
