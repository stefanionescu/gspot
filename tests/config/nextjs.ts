import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';

const NEXT_ROUTE = `// Answers the same address as the page.

/**
 * Answers a request.
 * @returns the answer
 */
export function GET(): Response {
    return new Response("ok");
}
`;

const NEXT_PACKAGE_JSON =
    '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"next":"16.3.5","next-intl":"4.3.9","react":"19.1.1","react-dom":"19.1.1"}}\n';

// The test Next.js configuration, page, and layout.
/** The Next.js configuration enabling Strict Mode. */
const NEXT_CONFIG_FILE = `// The framework configuration.
const config = { reactStrictMode: true };

export default config;
`;

/** The home page emitted by the test application. */
export const NEXT_PAGE = `// The home page.

/**
 * Renders the home page.
 * @returns the page
 */
export default function Page(): string {
    return "home";
}
`;

/** The root layout. */
export const NEXT_LAYOUT = `// The root layout.
import type { ReactNode } from 'react';

/**
 * Wraps every page.
 * @param props the children
 * @param props.children the page
 * @returns the document
 */
export default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
`;

export const NEXT_REPOSITORY = {
    configurations: ['nextjs'],

    files: {
        'package.json': NEXT_PACKAGE_JSON,
        'next.config.mjs': NEXT_CONFIG_FILE,
        'app/page.tsx': NEXT_PAGE,
        'app/layout.tsx': NEXT_LAYOUT,
    },
} as const;

export const NEXT_CASES = [
    {
        check: 'nextjs/route-segments',
        files: { 'app/route.ts': NEXT_ROUTE },
        expected: { file: 'app/route.ts', rule: 'route-segment', line: 1 },
        corrected: { files: { 'app/api/route.ts': NEXT_ROUTE } },
    },
    {
        check: 'nextjs/next-config',
        files: {
            'next.config.mjs': `// The framework configuration.
const config = { eslint: { ignoreDuringBuilds: true } };

export default config;
`,
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
] as const;

/** A missing imported page dependency fails native bundling. */
export const NEXT_BUILD_FAILURE_PAGE =
    "import Missing from './missing-component';\nexport default function Page() { return <Missing />; }\n";

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

/** Locale messages shared by native Next.js configuration scenarios. */
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
                check: 'nextjs/next-config',
                file: 'next.config.ts',
                line: 4,
                rule: 'env-secret',
                message: 'API_SECRET under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'nextjs/next-config',
                file: 'next.config.ts',
                line: 5,
                rule: 'env-secret',
                message: 'PASSWORD under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'nextjs/next-config',
                file: 'next.config.ts',
                line: 6,
                rule: 'env-secret',
                message: 'TOKEN under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'nextjs/next-config',
                file: 'next.config.ts',
                line: 8,
                rule: 'checks-off',
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
                check: 'nextjs/next-config',
                file: 'next.config.ts',
                line: 2,
                rule: 'checks-off',
                message: 'ignoreDuringBuilds: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
            {
                check: 'nextjs/next-config',
                file: 'next.config.ts',
                line: 3,
                rule: 'checks-off',
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

/** The SDK-only root has no app; the child app owns its complete build inputs. */
export const NEXT_BUILD_FILES = {
    'package.json': '{"dependencies":{"next":"16.3.5"}}',
    'library.ts': 'export const count = 1;\n',
    'web/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'web/tsconfig.json': '{}',
    'web/src/data.ts': 'export const count = 1;\n',
} as const;

export const NEXT_BUILD_TABLES = `[[scope]]
path = "web"
configurations = ["nextjs"]
`;

/** Next.js accepts either router at the project root or under src. */
export const NEXT_BUILD_ROUTES = [
    'app/page.tsx',
    'src/app/page.tsx',
    'pages/index.tsx',
    'src/pages/index.tsx',
] as const;

export const TSC_FAILURE_OUTPUT = 'src/app/page.ts(1,1): error TS2322: Type mismatch\n';

export const BUILD_FAILURE_OUTPUT = 'Error: Page is invalid\n';

export const NEXT_VERSION_OUTPUT = 'Next.js v16.3.5';

export const TYPESCRIPT_VERSION_OUTPUT = 'Version 5.9.3';

export const NEXT_CACHE_BYTES = [0, 255, 1, 2] as const;
