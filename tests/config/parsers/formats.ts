export const SYNTAX_ERRORS = [
    {
        path: 'package.json',
        source: '{',
        message: 'package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.',
    },
    {
        path: 'bun.lock',
        source: '{"value": }',
        message: 'bun.lock:1:11 is not valid JSON: ValueExpected. Fix the file.',
    },
];

export const MALFORMED_BLOCKS = [
    { path: 'AGENTS.md', source: '<!-- >>> gspot managed >>> -->\nbody\n' },
    { path: 'AGENTS.md', source: 'body\n<!-- <<< gspot managed <<< -->\n' },
    {
        path: 'AGENTS.md',
        source: `<!-- <<< gspot managed <<< -->
body
<!-- >>> gspot managed >>> -->
`,
    },
    {
        path: 'AGENTS.md',
        source: `<!-- >>> gspot managed >>> -->
<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
`,
    },
    {
        path: 'AGENTS.md',
        source: `<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
<!-- <<< gspot managed <<< -->
`,
    },
] as const;

export const BLOCK_FORMATS = [
    {
        path: 'AGENTS.md',
        start: '<!-- >>> gspot managed >>> -->',
        end: '<!-- <<< gspot managed <<< -->',
    },
    { path: '.gitignore', start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
] as const;

export const NGINX_DIRECTIVE_CASES: { source: string; expected: [string, ...string[]][] }[] = [
    {
        source: 'location / { proxy_pass "https://api:3000"; add_header X-Value "two  spaces # text"; }',
        expected: [
            ['location', '/'],
            ['proxy_pass', 'https://api:3000'],
            ['add_header', 'X-Value', 'two  spaces # text'],
        ],
    },
    {
        source: 'set $empty ""; set $value ${upstream}; include /etc/tls#local.conf; # include /ignored;\n',
        expected: [
            ['set', '$empty', ''],
            ['set', '$value', '${upstream}'],
            ['include', '/etc/tls#local.conf'],
        ],
    },
    {
        source: String.raw`set $value "tab\tnewline\nreturn\rquote\"slash\\";`,
        expected: [['set', '$value', 'tab\tnewline\nreturn\rquote"slash\\']],
    },
];
