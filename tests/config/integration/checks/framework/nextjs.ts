import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

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

const NEXT_CONFIG_SOURCE = `// The framework configuration.
const config = { reactStrictMode: true };

export default config;
`;

const NEXT_PAGE = `// The home page.

/**
 * Renders the home page.
 * @returns text for the application entry route
 */
export default function Page(): string {
    return "home";
}
`;

const NEXT_LAYOUT =
    '// The root layout.\nimport type { ReactNode } from \'react\';\n\n/**\n * Wraps every page.\n * @param props content to place inside the document body\n * @param props.children route content to render inside the body\n * @returns the HTML wrapper shared by every route\n */\nexport default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {\n    return (\n        <html lang="en">\n            <body>{children}</body>\n        </html>\n    );\n}\n';

export const NEXT_MESSAGES = {
    'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
    'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
} as const;

export const NEXTJS_SANDBOX = {
    configurations: ['nextjs', 'translations'],
    json: {
        'tsconfig.json': {
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

export const REFERENCED_PROJECT_FINDING = {
    file: 'compiler-ref/source.ts',
    rule: 'TS2322',
    line: 1,
    column: 14,
    message: "Type 'string' is not assignable to type 'number'.",
} as const;
