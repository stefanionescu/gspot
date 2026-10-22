export const LOCAL_PLUGIN_TABLES = `[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
`;

export const SCOPE_PLUGIN_TABLES = `${LOCAL_PLUGIN_TABLES}
[[scope]]
path = "app"
configurations = ["javascript"]
[[scope.tools.eslint.plugins]]
name = "scoped"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
[[scope]]
path = "app/nested"
configurations = ["javascript"]
`;

export const LOCAL_PLUGIN = `export default {
    rules: {
        'no-forbidden': {
            meta: { type: 'problem', schema: [] },
            create(context) {
                return {
                    Identifier(node) {
                        if (node.name === 'forbidden') context.report({ node, message: 'Use the current API.' });
                    },
                };
            },
        },
    },
};
`;

export const SCOPE_PLUGIN_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"private":true,"type":"module"}\n',
    'tools/lint/plugin.mjs': LOCAL_PLUGIN,
    'source.js': 'export const forbidden = 1;\n',
    'outside/source.js': 'export const forbidden = 1;\n',
    'app/package.json': '{"private":true,"type":"module"}\n',
    'app/source.js': 'export const forbidden = 1;\n',
    'app/nested/package.json': '{"private":true,"type":"module"}\n',
    'app/nested/source.js': 'export const forbidden = 1;\n',
};

export const SCOPE_PLUGIN_FINDINGS = [
    { file: 'app/nested/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'app/nested/source.js', rule: 'scoped/no-forbidden', line: 1 },
    { file: 'app/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'app/source.js', rule: 'scoped/no-forbidden', line: 1 },
    { file: 'outside/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'source.js', rule: 'local/no-forbidden', line: 1 },
];

export const CONFLICTING_LOCAL_PLUGIN_TABLES = `[[scope]]
path = "first"
configurations = ["javascript"]
[[scope.tools.eslint.plugins]]
name = "local"
path = "tools/lint/first.mjs"
rules = { "no-forbidden" = [] }
[[scope]]
path = "second"
configurations = ["javascript"]
[[scope.tools.eslint.plugins]]
name = "local"
path = "tools/lint/second.mjs"
rules = { "no-forbidden" = [] }
`;

export const CONFLICTING_LOCAL_PLUGIN_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'first/package.json': '{"private":true,"type":"module"}\n',
    'second/package.json': '{"private":true,"type":"module"}\n',
    'tools/lint/first.mjs': LOCAL_PLUGIN,
    'tools/lint/second.mjs': LOCAL_PLUGIN,
};

/** The settings error of one plugin name with two modules. */
export const DUPLICATE_PLUGIN_ERROR = {
    name: 'GspotError',
    code: 'settings',
    message:
        'tools.eslint.plugins: local names two modules, tools/lint/first.mjs and tools/lint/second.mjs. Give each its own prefix.',
} as const;
