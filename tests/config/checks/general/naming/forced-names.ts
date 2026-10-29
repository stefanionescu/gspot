export const FORCED_NAME_CASES = [
    {
        check: 'naming/paths',
        configurations: ['javascript'],
        path: 'src/__tests__/total.test.js',
        source: 'export const total = 1;\n',
        findings: [],
    },
    {
        check: 'naming/paths',
        configurations: ['javascript'],
        path: 'src/__mocks__/fs.js',
        source: 'export const read = 1;\n',
        findings: [],
    },
    {
        check: 'naming/paths',
        configurations: ['python'],
        path: 'pkg/__pycache__/cache_file.py',
        source: 'cached = 1\n',
        findings: [],
    },
    {
        check: 'naming/identifiers',
        configurations: ['typescript', 'supabase'],
        path: 'supabase/functions/_shared/cors.ts',
        source: 'export const corsHeaders = {};\n',
        findings: [],
    },
    {
        check: 'naming/identifiers',
        configurations: ['swift'],
        path: 'Sources/App/ListController.swift',
        source: 'var snapshot = NSDiffableDataSourceSnapshot<Int, String>()\n',
        findings: [],
    },
    {
        check: 'naming/identifiers',
        configurations: ['javascript', 'nextjs'],
        path: 'app/blog/page.js',
        source: 'export default function Page() { return null; }\n',
        findings: [],
    },
    {
        check: 'naming/identifiers',
        configurations: ['typescript'],
        path: 'source.ts',
        source: 'export const coreCount = 1;\n',
        findings: [
            {
                file: 'source.ts',
                line: 1,
                rule: 'banned-word',
                message: 'typescript variable "coreCount": "core" is banned (containers list).',
            },
        ],
    },
    {
        check: 'naming/paths',
        configurations: ['typescript'],
        path: 'support/port.ts',
        source: 'export const port = 1;\n',
        findings: [
            {
                file: 'support/port.ts',
                line: 1,
                rule: 'banned-word',
                message: 'typescript folder "support": "support" is banned (folders list).',
            },
        ],
    },
] as const;
