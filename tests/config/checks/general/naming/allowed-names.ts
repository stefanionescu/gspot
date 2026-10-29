const ALLOWED_NAME_LAYOUT = {
    configurations: ['naming', 'bash'],
    naming: {
        override: [
            { allowed_names: ['remoteRecord'], reason: 'The external JavaScript interface fixes this name.' },
            {
                paths: ['web/**'],
                allowed_names: ['remoteRecord'],
                reason: 'The external JavaScript interface fixes this name.',
            },
            {
                paths: ['worker/**'],
                allowed_names: ['remote_record'],
                reason: 'The external Python interface fixes this name.',
            },
        ],
    },
    scope: [
        { path: 'web', configurations: ['javascript'] },
        { path: 'worker', configurations: ['python'] },
    ],
} as const;

const ALLOWED_NAME_FILES = {
    'entry.sh': 'echo ready\n',
    'web/source.js': 'export const remoteRecord = 1;\n',
    'worker/source.py': 'remote_record = 1\n',
} as const;

export const UNUSED_NAME_CASES = [
    {
        name: 'a properties record whose name only a function uses is unused',
        files: { 'source.js': 'export function requestName() {}\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        categories: ['properties'],
                        allowed_names: ['requestName'],
                        reason: 'The external API fixes this property name.',
                    },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "requestName", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'an allowed stem of an unparsable file counts as used',
        files: { 'brokenName.js': 'export const = ;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        categories: ['files'],
                        allowed_names: ['brokenName'],
                        reason: 'The external tool fixes this file name.',
                    },
                ],
            },
        },
        messages: [],
    },

    {
        name: 'a files-only allowance names the second file in a folder',
        files: {
            'src/first.js': 'export const one = 1;\n',
            'src/second.js': 'export const two = 2;\n',
        },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['src/**'],
                        categories: ['files'],
                        allowed_names: ['second'],
                        reason: 'The external tool fixes this file name.',
                    },
                ],
            },
        },
        messages: [],
    },
    {
        name: 'allowances name code or files',
        files: { 'phantomName.js': '// commentName\nexport const keptName = true;\n' },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['*.js'],
                        allowed_names: ['keptName', 'phantomName', 'commentName'],
                        reason: 'The external API declares these exact names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files', 'variables'],
                        allowed_names: ['phantomName', 'keptName'],
                        reason: 'Exact API names.',
                    },
                    {
                        paths: ['*.js'],
                        categories: ['files'],
                        allowed_names: ['missingFile'],
                        reason: 'The external interface fixes this filename.',
                    },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "commentName", which no identifier under its paths uses.',
            '[[naming.override]] record 3 allowed_names includes "missingFile", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'a sibling declaration cannot satisfy an authored source pattern',
        files: {
            'app/source.js': 'export const keptName = true;\n',
            'worker/source.js': 'export const siblingName = true;\n',
        },
        settings: {
            configurations: ['javascript'],
            naming: {
                override: [
                    {
                        paths: ['app/**'],
                        allowed_names: ['keptName', 'siblingName'],
                        reason: 'The app interface fixes these exact names.',
                    },
                ],
            },
            scope: [{ path: 'app' }, { path: 'worker' }],
        },
        messages: [
            '[[naming.override]] record 1 allowed_names includes "siblingName", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'each scope keeps the allowance that its own source uses',
        files: ALLOWED_NAME_FILES,
        settings: ALLOWED_NAME_LAYOUT,
        messages: [],
    },
    {
        name: 'an allowance for the name of another language is unused',
        files: ALLOWED_NAME_FILES,
        settings: {
            ...ALLOWED_NAME_LAYOUT,
            naming: {
                override: [
                    ALLOWED_NAME_LAYOUT.naming.override[0],
                    ALLOWED_NAME_LAYOUT.naming.override[1],
                    { ...ALLOWED_NAME_LAYOUT.naming.override[2], allowed_names: ['remoteRecord'] },
                ],
            },
        },
        messages: [
            '[[naming.override]] record 3 allowed_names includes "remoteRecord", which no identifier under its paths uses.',
        ],
    },
    {
        name: 'a renamed source leaves both of its allowances unused',
        files: { ...ALLOWED_NAME_FILES, 'web/source.js': 'export const localRecord = 1;\n' },
        settings: ALLOWED_NAME_LAYOUT,
        messages: [
            '[[naming.override]] record 1 allowed_names includes "remoteRecord", which no identifier under its paths uses.',
            '[[naming.override]] record 2 allowed_names includes "remoteRecord", which no identifier under its paths uses.',
        ],
    },
] as const;
