export const AUTHORED_PACKAGE_FIELDS = {
    name: 'example-package',
    dependencies: { next: '16.0.0' },
    'simple-git-hooks': null,
    customSettings: { enabled: true },
} as const;

export const RUNTIME_EVIDENCE_CASES = [
    {
        name: 'node engine',
        runtime: 'node',
        package: {
            engines: {
                node: '>=1',
            },
        },
        source: '',
        detected: true,
    },
    {
        name: 'node script',
        runtime: 'node',
        package: {
            scripts: {
                start: 'node run entry.js',
            },
        },
        source: '',
        detected: true,
    },
    {
        name: 'node shebang',
        runtime: 'node',
        package: {},
        source: '#!/usr/bin/env node\nconsole.log(1);\n',
        detected: true,
    },
    {
        name: 'node quoted script text',
        runtime: 'node',
        package: {
            scripts: {
                start: 'echo "node entry.js"',
            },
        },
        source: '',
        detected: false,
    },
    {
        name: 'node type dependency',
        runtime: 'node',
        package: {
            devDependencies: {
                '@types/node': '1.0.0',
            },
        },
        source: '',
        detected: false,
    },
    {
        name: 'node private tool manifest',
        runtime: 'node',
        package: {},
        source: '',
        privatePackage: {
            engines: {
                node: '>=1',
            },
        },
        detected: false,
    },
    {
        name: 'bun engine',
        runtime: 'bun',
        package: {
            engines: {
                bun: '>=1',
            },
        },
        source: '',
        detected: true,
    },
    {
        name: 'bun script',
        runtime: 'bun',
        package: {
            scripts: {
                start: 'bun run entry.js',
            },
        },
        source: '',
        detected: true,
    },
    {
        name: 'bun shebang',
        runtime: 'bun',
        package: {},
        source: '#!/usr/bin/env bun\nconsole.log(1);\n',
        detected: true,
    },
    {
        name: 'bun quoted script text',
        runtime: 'bun',
        package: {
            scripts: {
                start: 'echo "bun entry.js"',
            },
        },
        source: '',
        detected: false,
    },
    {
        name: 'bun type dependency',
        runtime: 'bun',
        package: {
            devDependencies: {
                '@types/bun': '1.0.0',
            },
        },
        source: '',
        detected: false,
    },
    {
        name: 'bun private tool manifest',
        runtime: 'bun',
        package: {},
        source: '',
        privatePackage: {
            engines: {
                bun: '>=1',
            },
        },
        detected: false,
    },
    {
        name: 'deno engine',
        runtime: 'deno',
        package: {
            engines: {
                deno: '>=1',
            },
        },
        source: '',
        detected: true,
    },
    {
        name: 'deno script',
        runtime: 'deno',
        package: {
            scripts: {
                start: 'deno run entry.js',
            },
        },
        source: '',
        detected: true,
    },
    {
        name: 'deno shebang',
        runtime: 'deno',
        package: {},
        source: '#!/usr/bin/env deno\nconsole.log(1);\n',
        detected: true,
    },
    {
        name: 'deno quoted script text',
        runtime: 'deno',
        package: {
            scripts: {
                start: 'echo "deno entry.js"',
            },
        },
        source: '',
        detected: false,
    },
    {
        name: 'deno type dependency',
        runtime: 'deno',
        package: {
            devDependencies: {
                '@types/deno': '1.0.0',
            },
        },
        source: '',
        detected: false,
    },
    {
        name: 'deno private tool manifest',
        runtime: 'deno',
        package: {},
        source: '',
        privatePackage: {
            engines: {
                deno: '>=1',
            },
        },
        detected: false,
    },
    {
        name: 'JavaScript without a declared runtime',
        runtime: 'node',
        package: {},
        source: 'console.log(1);\n',
        detected: false,
    },
];
