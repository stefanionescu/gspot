import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';
import { NEXT_PAGE, NEXT_LAYOUT, NEXT_MESSAGES, NEXT_CONFIG_FILE } from '#tests/config/samples/nextjs.ts';

export const COUNT = '// A test file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n';

/** A missing imported page dependency fails native bundling. */
export const BUILD_FAILURE =
    "import Missing from './missing-component';\nexport default function Page() { return <Missing />; }\n";

export const PACKAGE = {
    name: 'example',
    version: '1.0.0',
    description: 'A test Next.js app for the tests.',
    private: true,
    type: 'module',
    scripts: {
        build: 'next build --webpack',
    },
    dependencies: {
        'next-intl': '4.3.9',
    },
};

export const REPOSITORY: InstalledScenario = {
    configurations: ['nextjs'],
    tsconfig: {
        compilerOptions: {
            ...STRICT_COMPILER_OPTIONS,
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'react-jsx',
            lib: ['DOM', 'DOM.Iterable', 'ES2022'],
            noEmit: true,
            plugins: [{ name: 'next' }],
        },
        include: ['app'],
    },
    without: ['css'],
    files: {
        '.gitignore': 'node_modules\n.next\n',
        'next.config.mjs': NEXT_CONFIG_FILE,
        'app/page.tsx': NEXT_PAGE,
        'app/layout.tsx': NEXT_LAYOUT,
        ...NEXT_MESSAGES,
    },
};

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

export const REFERENCE_PROJECT_FILES = {
    'compiler-ref/tsconfig.json':
        '{"compilerOptions":{"composite":true,"strict":true,"types":[],"outDir":"./dist"},"files":["source.ts"]}\n',
    'compiler-ref/source.ts': 'export const value: number = "wrong";\n',
};
