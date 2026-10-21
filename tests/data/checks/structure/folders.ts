import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

export const ROUTE_CASES = [
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

export const PREFIX_TREE = {
    'cards/asset-card.ts': '',
    'cards/asset-list.ts': '',
    'cards/asset-row.ts': '',
    'cards/other.ts': '',
    'mixed/turn.ts': '',
    'mixed/turn-flow/first.ts': '',
    'mixed/turn-flow/second.ts': '',
    'fine/index.ts': '',
    'fine/index-page.ts': '',
    'fine/first.ts': '',
    'fine/second.ts': '',
    'components/button.tsx': '',
    'components/button.module.css': '',
    'components/button.test.tsx': '',
    'components/card.tsx': '',
    'paired/api.ts': '',
    'paired/api.d.ts': '',
    'paired/view.mts': '',
    'paired/view.d.mts': '',
    'paired/social.png': '',
    'paired/social.svg': '',
    'npm/package.json': '{}',
    'npm/package-lock.json': '{}',
    'pnpm/pnpm-lock.yaml': '',
    'pnpm/pnpm-workspace.yaml': '',
} as const;

export const FILE_FOLDER_CLASH_CASES = [
    {
        check: 'structure/file-folder-clashes',
        corrected: {
            files: {
                'jobs/turned.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
            },
        },
        files: {
            'jobs/turn.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
        },
        expected: {
            file: 'jobs/turn.sh',
            rule: 'stem-collision',
            line: 1,
        },
    },
] as const;

export const PREFIX_CHECK_OPTIONS = { only: ['structure/shared-prefixes'] };

export const NEST_SUFFIX_FILES = {
    'app/jsx.view.tsx': '',
    'app/jsx.service.tsx': '',
    'app/jsx.controller.tsx': '',
    'app/custom.one.ts': '',
    'app/custom.two.ts': '',
    'app/custom.three.ts': '',
};

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
