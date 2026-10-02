// The built-in Next.js and locale checks on a planted project, run in-process: each fires on its defect and accepts the
// correction.
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { NEXT_PAGE, NEXT_CONFIG, NEXT_LAYOUT } from '#tests/samples/nextjs.ts';

/** The i18n settings naming the message directory and base locale. */
const NEXT_TRANSLATIONS = '[tools.i18n]\nlocales = {directory = "messages", base = "en"}\n';

const ROUTE =
    '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n';

const MANIFEST = `${JSON.stringify(
    {
        name: 'planted',
        version: '1.0.0',
        private: true,
        type: 'module',
        dependencies: { next: '16.3.5', 'next-intl': '4.3.9', react: '19.1.1', 'react-dom': '19.1.1' },
    },
    null,
    4,
)}\n`;

plantedCases(
    'the built-in nextjs checks',
    {
        kits: ['nextjs', 'i18n'],
        modules: false,
        installs: false,
        files: {
            'package.json': MANIFEST,
            'next.config.mjs': NEXT_CONFIG,
            'app/page.tsx': NEXT_PAGE,
            'app/layout.tsx': NEXT_LAYOUT,
            'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
            'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
        },
    },
    [
        {
            check: 'nextjs/route-segments',
            files: { 'app/route.ts': ROUTE },
            expected: { file: 'app/route.ts', rule: 'route-segment', line: 1 },
            corrected: { files: { 'app/api/route.ts': ROUTE } },
        },
        {
            check: 'nextjs/config',
            files: {
                'next.config.mjs':
                    '// The framework kit.\nconst config = { eslint: { ignoreDuringBuilds: true } };\n\nexport default config;\n',
            },
            expected: { file: 'next.config.mjs', rule: 'build-check-off', line: 2 },
        },
        {
            check: 'nextjs/version-pairs',
            files: { 'package.json': MANIFEST.replace('"react-dom": "19.1.1"', '"react-dom": "18.3.1"') },
            expected: { file: 'package.json', rule: 'version-pair', line: 1 },
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
