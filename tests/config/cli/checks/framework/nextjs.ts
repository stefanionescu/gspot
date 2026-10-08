import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { ROUTE, MANIFEST, NEXT_TRANSLATIONS } from '#tests/config/cli/checks/nextjs.ts';
import { NEXT_PAGE, NEXT_LAYOUT, NEXT_CONFIG_FILE } from '#tests/config/samples/nextjs.ts';

export const REPOSITORY: RepositoryScenario = {
    configurations: ['nextjs', 'i18n'],
    modules: false,
    installs: false,
    files: {
        'package.json': MANIFEST,
        'next.config.mjs': NEXT_CONFIG_FILE,
        'app/page.tsx': NEXT_PAGE,
        'app/layout.tsx': NEXT_LAYOUT,
        'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
        'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'nextjs/route-segments',
        files: { 'app/route.ts': ROUTE },
        expected: { file: 'app/route.ts', rule: 'route-segment', line: 1 },
        corrected: { files: { 'app/api/route.ts': ROUTE } },
    },
    {
        check: 'nextjs/next-config',
        files: {
            'next.config.mjs':
                '// The framework configuration.\nconst config = { eslint: { ignoreDuringBuilds: true } };\n\nexport default config;\n',
        },
        expected: { file: 'next.config.mjs', rule: 'checks-off', line: 2 },
    },
    {
        check: 'react/version-pairs',
        files: {
            'node_modules/react/package.json': '{"name":"react","version":"19.1.1"}\n',
            'node_modules/react-dom/package.json': '{"name":"react-dom","version":"18.3.1"}\n',
            'package.json':
                '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"next":"16.3.5","next-intl":"4.3.9","react":"19.1.1","react-dom":"18.3.1"}}\n',
        },
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
];
