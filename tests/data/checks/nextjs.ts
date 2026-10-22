// The test Next.js configuration, page, and layout.

import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

/** The Next.js configuration enabling Strict Mode. */
const NEXT_CONFIG_SOURCE = `// The framework configuration.
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
        'next.config.mjs': NEXT_CONFIG_SOURCE,
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

export const TSC_FAILURE_OUTPUT = 'src/app/page.ts(1,1): error TS2322: Type mismatch\n';

export const NEXT_VERSION_OUTPUT = 'Next.js v16.3.5';

export const TYPESCRIPT_VERSION_OUTPUT = 'Version 5.9.3';
export const NEXT_CACHE_BYTES = [0, 255, 1, 2] as const;

/** The finding of the referenced project. */
export const REFERENCED_PROJECT_FINDING = {
    file: 'compiler-ref/source.ts',
    rule: 'TS2322',
    line: 1,
    column: 14,
} as const;

/** The Next.js output folders that a check keeps. */
export const OUTPUT_PRESERVATION_CASES = [
    { name: 'root', scope: '' },
    { name: 'app', scope: 'app' },
] as const;
