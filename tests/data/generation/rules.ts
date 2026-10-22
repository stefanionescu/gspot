/** Runtime guidance keeps Node assumptions out of React Native and Expo applications. */
/** Scripts by runtime and the runtime rule files that each selects; React Native and Expo packages get no NODE.md. */
export const RUNTIME_RULE_CASES = [
    { name: 'a Deno script', runtime: 'deno', dependency: undefined, rules: ['DENO.md'] },
    { name: 'a Node.js script', runtime: 'node', dependency: undefined, rules: ['NODE.md'] },
    { name: 'a Node.js script in a React Native package', runtime: 'node', dependency: 'react-native', rules: [] },
    { name: 'a Node.js script in an Expo package', runtime: 'node', dependency: 'expo', rules: [] },
] as const;

export const RULE_CONFIGURATIONS = ['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'] as const;

export const JAVASCRIPT_IN_APP_TABLES = '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n';
export const NAMING_RULE_LEVEL_CASES = [
    { configuration: 'bash', path: 'language/bash/rules/BASH.md' },
    { configuration: 'css', path: 'language/css/rules/CSS.md' },
    { configuration: 'html', path: 'language/html/rules/HTML.md' },
    { configuration: 'python', path: 'language/python/rules/PYTHON.md' },
    { configuration: 'sql', path: 'language/sql/rules/SQL.md' },
    { configuration: 'swift', path: 'language/swift/rules/SWIFT.md' },
    { configuration: 'typescript', path: 'language/typescript/rules/TYPESCRIPT.md' },
] as const;
export const RULE_CORRECTNESS_CASES = [
    {
        configuration: 'engineering',
        path: 'general/engineering/rules/WORKING.md',
        instructions: [
            'Treat stored data and wire formats as contracts.',
            'During a rolling deploy, readers accept both shapes until no old writer runs.',
        ],
    },
    {
        configuration: 'bash',
        path: 'language/bash/rules/BASH.md',
        instructions: [
            'End an executable script with a meaningful status.',
            'optional cleanup check set the exit status.',
        ],
    },
    {
        configuration: 'supabase',
        path: 'platform/supabase/rules/SUPABASE.md',
        instructions: [
            'Validate user-controlled key segments and limit their length before use.',
            'Do not embed secrets, provider tokens, raw user text, or private identifiers in object keys.',
        ],
    },
    {
        configuration: 'express',
        path: 'framework/express/rules/EXPRESS.md',
        instructions: [
            'middleware validates and authenticates',
            'validateBody(submitOrderSchema)',
            'Middleware can enforce ownership.',
            'A permission check that depends on domain state belongs in a module, and a transport-level one in ownership middleware.',
        ],
    },
] as const;
