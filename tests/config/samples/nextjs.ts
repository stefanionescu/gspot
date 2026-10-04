// The test Next.js configuration, page, and layout.
/** The Next.js configuration enabling Strict Mode. */
export const NEXT_CONFIG_FILE =
    '// The framework configuration.\nconst config = { reactStrictMode: true };\n\nexport default config;\n';

/** The home page rendered by the test application. */
export const NEXT_PAGE =
    '// The home page.\n\n/**\n * Renders the home page.\n * @returns the page\n */\nexport default function Page(): string {\n    return "home";\n}\n';

/** The root layout. */
export const NEXT_LAYOUT =
    '// The root layout.\nimport type { ReactNode } from \'react\';\n\n/**\n * Wraps every page.\n * @param props the children\n * @param props.children the page\n * @returns the document\n */\nexport default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {\n    return (\n        <html lang="en">\n            <body>{children}</body>\n        </html>\n    );\n}\n';
