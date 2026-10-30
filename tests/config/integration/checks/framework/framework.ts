import { NEXT_MESSAGES } from '#tests/config/translations.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';
import { NESTJS_CONTROLLER, NESTJS_CONTROLLER_UNSUPPRESSED } from '#tests/config/nestjs.ts';
import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/integration/checks/component-samples.ts';

export const ASTRO_PAGE = `---
const title: string = 'Home';
---

<h1>{title}</h1>
<img src="logo.png" alt="The logo" />
`;

export const ASTRO_PAGE_PATH = 'src/pages/index.astro';

const NESTJS_DIRECTIVE_FINDINGS = [
    {
        file: 'src/greeting.controller.ts',
        line: 15,
        column: 5,
        message: "Unused eslint-disable directive (no problems were reported from 'gspot/no-trivial-functions').",
    },
    {
        file: 'src/greeting.controller.ts',
        line: 25,
        column: 5,
        message: "Unused eslint-disable directive (no problems were reported from 'gspot/no-trivial-functions').",
    },
] as const;

export const NESTJS_CASES = [
    {
        name: 'a route parameter decorator names its route parameter',
        check: 'javascript/eslint',
        files: {
            'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED.replace("@Param('name')", "@Param('other')"),
        },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED } },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 24,
        },
    },
    {
        name: 'class constructors and methods need no trivial-function suppression',
        check: 'javascript/eslint',
        files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED } },
        expected: NESTJS_DIRECTIVE_FINDINGS[0],
        findings: NESTJS_DIRECTIVE_FINDINGS,
    },
] as const;

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
Renders the home page.
@returns text for the application entry route
*/
export default function Page(): string {
    return "home";
}
`;

const NEXT_LAYOUT = `// The root layout.
import type { ReactNode } from 'react';

/**
Wraps every page.
@param props content to place inside the document body
@param props.children route content to render inside the body
@returns the HTML wrapper shared by every route
*/
export default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
`;

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
        '.gitignore': `node_modules
.next
`,
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
} as const;

export const WEB_TSCONFIG = {
    compilerOptions: {
        ...STRICT_COMPILER_OPTIONS,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        lib: ['DOM', 'ES2022'],
    },
    include: ['src'],
} as const;

export const CLEAN_COMPONENT = `// A test component.
import type { ReactNode } from 'react';

/**
Greets one person.

@param props display text for the visitor
@param props.name text shown inside the paragraph
@returns a paragraph addressed to the visitor
*/
export function Greeting({ name }: Readonly<{ name: string }>): ReactNode {
    return <p>{name}</p>;
}
`;

const COUNTER = `// A test component.
import { useState, type ReactNode } from "react";

/**
Counts, some of the time.

@param props display controls for this component
@param props.isOn whether the counter is visible
@returns the current total in a paragraph
*/
export function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {
    if (isOn) {
        const [count] = useState(0);
        return <p>{count}</p>;
    }
    return <p>off</p>;
}
`;

export const REACT_CASES = [
    {
        check: 'javascript/eslint',
        files: { 'src/Counter.tsx': COUNTER },
        expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 13 },
        corrected: {
            files: {
                'src/Counter.tsx': CLEAN_COMPONENT.replace('function Greeting', 'function Counter'),
            },
        },
    },
] as const;

export const CLEAN_SVELTE =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';

export const SVELTE_SANDBOX = {
    configurations: ['typescript', 'svelte', 'css', 'format'],
    json: { 'tsconfig.json': COMPONENT_TSCONFIG },
    files: {
        'src/answer.ts': ANSWER_MODULE,
        'src/Greeting.svelte': CLEAN_SVELTE,
    },
} as const;

export const SVELTE_CASES = [
    {
        check: 'css/stylelint',
        files: {
            'src/Binding.svelte': `<p>Card</p>
<style>
.card {
    color: v-bind(color);
}
</style>
`,
        },
        expected: { file: 'src/Binding.svelte', rule: 'function-no-unknown', line: 4 },
        findings: [
            { file: 'src/Binding.svelte', rule: 'declaration-property-value-no-unknown', line: 4 },
            { file: 'src/Binding.svelte', rule: 'function-no-unknown', line: 4 },
        ],
        corrected: {
            files: {
                'src/Binding.svelte': `<p>Card</p>
<style>
.card {
    color: red;
}
</style>
`,
            },
        },
    },
    {
        check: 'javascript/eslint',
        files: {
            'src/SharedPolicy.svelte': `<script lang="ts">
function shout(text: string): string { return text.toUpperCase(); }
</script>
<p>{shout('hello')}</p>
`,
        },
        expected: { file: 'src/SharedPolicy.svelte', rule: 'gspot/no-trivial-functions', line: 2 },
        corrected: {
            files: {
                'src/SharedPolicy.svelte': '<script lang="ts">\nconst answer = 42;\n</script>\n<p>{answer}</p>\n',
            },
        },
    },
    {
        check: 'svelte/svelte-check',
        files: {
            'src/Product.svelte':
                '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} />\n',
        },
        expected: { file: 'src/Product.svelte', rule: 'a11y_missing_attribute', line: 5 },
        corrected: {
            files: {
                'src/Product.svelte':
                    '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} alt="The product" />\n',
            },
        },
    },
    {
        check: 'svelte/svelte-check',
        files: {
            'src/Count.svelte': '<script lang="ts">\n    const count: number = \'one\';\n</script>\n\n<p>{count}</p>\n',
        },
        expected: { file: 'src/Count.svelte', rule: 'TS2322', line: 2 },
        corrected: {
            files: {
                'src/Count.svelte': '<script lang="ts">\n    const count: number = 1;\n</script>\n\n<p>{count}</p>\n',
            },
        },
    },
    {
        check: 'css/stylelint',
        files: {
            'src/Card.svelte': `<p class="card">card</p>

<style>
    :global(.card) {
        color: #ggg;
    }
</style>
`,
        },
        expected: { file: 'src/Card.svelte', rule: 'declaration-property-value-no-unknown', line: 5 },
        corrected: {
            files: {
                'src/Card.svelte': `<p class="card">card</p>

<style>
    :global(.card) {
        color: #abc;
    }
</style>
`,
            },
        },
    },
] as const;
