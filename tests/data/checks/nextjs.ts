// The test Next.js configuration, page, and layout.

import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

/** The Next.js configuration enabling Strict Mode. */
const NEXT_CONFIG_FILE = `// The framework configuration.
const config = { reactStrictMode: true };

export default config;
`;

/** The home page of the test application. */
const NEXT_PAGE = `// The home page.

/**
 * Renders the home page.
 * @returns text for the application entry route
 */
export default function Page(): string {
    return "home";
}
`;

/** The root layout. */
const NEXT_LAYOUT = `// The root layout.
import type { ReactNode } from 'react';

/**
 * Wraps every page.
 * @param props content to place inside the document body
 * @param props.children route content to render inside the body
 * @returns the HTML wrapper shared by every route
 */
export default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
`;

export const NEXT_PACKAGE = {
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
} as const;

/** Locale messages for the Next.js configuration tests. */
export const NEXT_MESSAGES = {
    'messages/en.json': `{
    "home": { "title": "Home", "greeting": "Hello {name}" }
}
`,
    'messages/de.json': `{
    "home": { "title": "Start", "greeting": "Hallo {name}" }
}
`,
} as const;

export const NEXTJS_SANDBOX = {
    configurations: ['nextjs', 'translations'],
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
} as const;

export const REFERENCE_PROJECT_FILES = {
    'compiler-ref/tsconfig.json':
        '{"compilerOptions":{"composite":true,"strict":true,"types":[],"outDir":"./dist"},"files":["source.ts"]}\n',
    'compiler-ref/source.ts': 'export const value: number = "wrong";\n',
} as const;

export const NEXT_CONFIG_CASES = [
    {
        name: 'keys after a nested env value',
        source: `export default {\n  env: {\n    NESTED: { API_TOKEN: "nested text" },\n    "API_SECRET": process.env.API_SECRET,\n    ["PASSWORD"]: process.env.PASSWORD,\n    TOKEN,\n  },\n  typescript: { ["ignoreBuildErrors"]: (true as const) },\n};\n`,
        expected: [
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 4,
                rule: 'nextjs.env-secret',
                message: 'API_SECRET under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 5,
                rule: 'nextjs.env-secret',
                message: 'PASSWORD under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 6,
                rule: 'nextjs.env-secret',
                message: 'TOKEN under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 8,
                rule: 'nextjs.checks-off',
                message: 'ignoreBuildErrors: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
        ],
    },
    {
        name: 'quoted and asserted literal disabled checks',
        source: `export default {\n  eslint: { "ignoreDuringBuilds": true satisfies boolean },\n  typescript: { ignoreBuildErrors: <boolean>true },\n};\n`,
        expected: [
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 2,
                rule: 'nextjs.checks-off',
                message: 'ignoreDuringBuilds: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 3,
                rule: 'nextjs.checks-off',
                message: 'ignoreBuildErrors: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
        ],
    },
    {
        name: 'comments, strings, false flags, and nested env values',
        source: `// env: { API_SECRET: "comment" }\nconst text = "ignoreBuildErrors: true";\nexport default {\n  env: { SETTINGS: { API_TOKEN: text }, PUBLIC_ENDPOINT: "https://example.com" },\n  eslint: { ignoreDuringBuilds: false },\n  typescript: { ignoreBuildErrors: enabled },\n};\n`,
        expected: [],
    },
] as const;

export const TSC_FAILURE_OUTPUT = 'src/app/page.ts(1,1): error TS2322: Type mismatch\n';

export const NEXT_VERSION_OUTPUT = 'Next.js v16.3.5';

export const TYPESCRIPT_VERSION_OUTPUT = 'Version 5.9.3';
export const NEXT_CACHE_BYTES = [0, 255, 1, 2] as const;
