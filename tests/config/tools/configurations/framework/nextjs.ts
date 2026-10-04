import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { NEXT_PAGE, NEXT_LAYOUT, NEXT_CONFIG_FILE } from '#tests/config/samples/nextjs.ts';

export const COUNT = '// A test file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['nextjs'],
    without: ['naming', 'spelling', 'css', 'files'],
    files: {
        '.gitignore': 'node_modules\n.next\n',
        'package.json': `{\n    "name": "example",\n    "version": "1.0.0",\n    "description": "A test Next.js app for the tests.",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "16.3.5",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "19.1.1"\n    }\n}\n`,
        'tsconfig.json': `{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": [\n            "DOM",\n            "DOM.Iterable",\n            "ES2022"\n        ],\n        "noEmit": true,\n        "plugins": [\n            {\n                "name": "next"\n            }\n        ]\n    },\n    "include": [\n        "app"\n    ]\n}\n`,
        'next.config.mjs': NEXT_CONFIG_FILE,
        'app/page.tsx': NEXT_PAGE,
        'app/layout.tsx': NEXT_LAYOUT,
        'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
        'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
    },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'nextjs/tsc',
        files: { 'app/count.ts': COUNT },
        expected: { file: 'app/count.ts', rule: 'TS2322', line: 4 },
        corrected: {
            files: {
                'app/count.ts':
                    '// A test file.\n\n/** A number that holds text. */\nexport const count: number = 3;\n',
            },
        },
    },
];
