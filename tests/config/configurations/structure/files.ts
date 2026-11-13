// environment readers
// environment readers
export const OS_VALUE_SOURCE = 'import os\nVALUE = os.environ["KEY"]\n';
export const PYTHON_ENVIRONMENT_SOURCE = `import os as system
from os import environ as values, getenv as read
first = system.environ["KEY"]
second = system.getenv("KEY")
third = values["KEY"]
fourth = read("KEY")
# system.environ
literal = 'system.getenv("KEY")'
def local(system):
    return system.environ
def bound():
    values = {}
    return values["KEY"]
from unrelated import getenv as other
fifth = other("KEY")
`;

// lone files
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

// shared prefixes
export const NESTJS_PREFIX_RESULTS: Array<{ scope: string; paths: string[] }> = [
    { scope: '', paths: ['feature.controller.spec.ts'] },
    { scope: 'app', paths: ['app/custom.one.ts', 'app/jsx.controller.tsx'] },
    { scope: 'app/deep', paths: [] },
    { scope: 'sibling', paths: ['sibling/feature.controller.spec.ts'] },
];
