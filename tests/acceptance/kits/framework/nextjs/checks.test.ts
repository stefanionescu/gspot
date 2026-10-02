// Planted repository for the nextjs and i18n configurations: a segment that serves two things, a build check turned off, versions apart, and message files with holes.
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { INSTALLED_MODULES } from '#tests/harness/cli/modules.ts';
import { NEXT_PAGE, NEXT_CONFIG, NEXT_LAYOUT } from '#tests/samples/nextjs.ts';

/** The i18n settings naming the message directory and base locale. */
const NEXT_TRANSLATIONS = '[tools.i18n]\ntranslations = {directory = "messages", base = "en"}\n';

const ROUTE =
    '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n';
const COUNT = '// A planted file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n';

plantedCases(
    'the nextjs configuration',
    {
        kits: ['nextjs'],
        without: ['naming', 'spelling', 'css', 'files'],
        // Webpack requires the linked dependencies and the sandbox to share a drive.
        dirname: join(INSTALLED_MODULES, '../..', `gspot-test-${randomUUID()}`),
        files: {
            '.gitignore': 'node_modules\n.next\n',
            'package.json': `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "16.3.5",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "19.1.1"\n    }\n}\n`,
            'tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "DOM.Iterable", "ES2022"],\n        "noEmit": true,\n        "plugins": [{ "name": "next" }]\n    },\n    "include": ["app"]\n}\n',
            'next.config.mjs': NEXT_CONFIG,
            'app/page.tsx': NEXT_PAGE,
            'app/layout.tsx': NEXT_LAYOUT,
            'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
            'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
        },
    },
    [
        {
            check: 'integrity/route-segments',
            files: { 'app/route.ts': ROUTE },
            expected: { file: 'app/route.ts', rule: 'route-segment', line: 1 },
            corrected: { files: { 'app/api/route.ts': ROUTE } },
        },
        {
            check: 'integrity/next-config',
            files: {
                'next.config.mjs':
                    '// The framework kit.\nconst config = { eslint: { ignoreDuringBuilds: true } };\n\nexport default config;\n',
            },
            expected: { file: 'next.config.mjs', rule: 'build-check-off', line: 2 },
        },
        {
            check: 'integrity/dependency-alignment',
            files: {
                'package.json': `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "16.3.5",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "18.3.1"\n    }\n}\n`,
            },
            expected: { file: 'package.json', rule: 'version-pair', line: 1 },
        },
        {
            check: 'nextjs/typecheck',
            files: { 'app/count.ts': COUNT },
            expected: { file: 'app/count.ts', rule: 'TS2322', line: 4 },
            corrected: { files: { 'app/count.ts': COUNT.replace('"three"', '3') } },
        },
        {
            check: 'nextjs/build',
            files: { 'app/page.tsx': NEXT_PAGE.replace('return "home";', 'return missing;') },
            // Turbopack refuses the linked node_modules folder of a planted repository, so the sandbox builds with webpack.
            policy: '[tools.next]\nbuild_in_gate = true\nbuild_flags = ["--webpack"]\n',
            expected: { file: 'package.json', rule: 'build', line: 1 },
        },
        {
            check: 'i18n/locales',
            files: { 'messages/de.json': '{\n    "home": { "title": "Start" }\n}\n' },
            policy: NEXT_TRANSLATIONS,
            expected: { file: 'messages/de.json', rule: 'missing-key', line: 1 },
        },
        {
            check: 'i18n/locales',
            files: { 'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name" }\n}\n' },
            policy: NEXT_TRANSLATIONS,
            expected: { file: 'messages/de.json', rule: 'message', line: 1 },
        },
    ],
);
