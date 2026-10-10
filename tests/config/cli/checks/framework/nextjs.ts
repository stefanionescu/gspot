import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';
import { NEXT_PAGE, NEXT_LAYOUT, NEXT_CONFIG_FILE } from '#tests/config/samples/nextjs.ts';

export const ROUTE =
    '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n';

export const MANIFEST =
    '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"next":"16.3.5","next-intl":"4.3.9","react":"19.1.1","react-dom":"19.1.1"}}\n';

export const REPOSITORY: InProcessScenario = {
    configurations: ['nextjs'],

    files: {
        'package.json': MANIFEST,
        'next.config.mjs': NEXT_CONFIG_FILE,
        'app/page.tsx': NEXT_PAGE,
        'app/layout.tsx': NEXT_LAYOUT,
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
];
