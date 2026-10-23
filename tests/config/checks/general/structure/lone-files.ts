export const FRAMEWORK_COMPONENT_CASES = [
    { framework: 'astro', name: 'index.astro', folder: 'src/pages', content: '<main>Example</main>\n' },
    { framework: 'svelte', name: 'Card.svelte', folder: 'src/lib', content: '<p>Example</p>\n' },
] as const;

export const LONE_FILE_TREE = {
    'lone/only.ts': '',
    'typed/one.ts': '',
    'typed/one.d.ts': '',
    'module/one.mts': '',
    'module/one.d.mts': '',
    'pair/first.ts': '',
    'pair/second.ts': '',
    'component/logic.ts': '',
    'component/View.astro': '<main>Example</main>',
    'schema/parser.ts': '',
    'schema/schema.json': '{}',
    'parent/main.ts': '',
    'parent/child/first.ts': '',
    'parent/child/second.ts': '',
    'dist/pkg/lone.ts': '',
    'allowed/only.ts': '',
} as const;

export const ROUTE_FILE_CASES = [
    {
        framework: 'Next.js',
        configurations: ['typescript', 'react', 'react-dom', 'nextjs'],
        files: {
            'app/about/page.tsx': 'export default function About() { return null; }\n',
            'app/api/health/route.ts': 'export function GET() { return new Response("ok"); }\n',
            'app/lone/widget.tsx': 'export const widget = 1;\n',
        },
        expected: 'app/lone/widget.tsx',
    },
    {
        framework: 'SvelteKit',
        configurations: ['typescript', 'svelte'],
        files: {
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'src/routes/users/+page.svelte': '<p>Users</p>\n',
            'src/routes/api/+server.ts': 'export function GET() { return new Response("ok"); }\n',
            'src/lib/cards/Card.svelte': '<p>Card</p>\n',
        },
        expected: 'src/lib/cards/Card.svelte',
    },
] as const;

export const LONE_CODE_FILES = [
    'dist/pkg/lone.ts',
    'lone/only.ts',
    'module/one.mts',
    'parent/main.ts',
    'typed/one.ts',
] as const;
