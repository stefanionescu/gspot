// What makes a line of a corpus file a rule statement, and what the corpus lint refuses.

/** The layers a corpus file can declare. */
export const RULE_LAYERS = [
    'agent',
    'code',
    'prose',
    'language',
    'runtime',
    'framework',
    'library',
    'tool',
    'platform',
    'database',
    'shared',
    'repository',
    'template',
];

/** The layers that name no repository, product, layout path or deployment target. */
export const BOUNDARY_LAYERS = ['agent', 'code', 'prose', 'language'];

/** Words a boundary layer must not carry outside inline code. */
export const BOUNDARY_TERMS = [
    /\bsrc\/app\b/u,
    /\bsrc\/modules\b/u,
    /\bplatform\/(?:db|providers)\b/u,
    /\bsupabase\/(?:migrations|functions)\b/u,
    /\bVirtua\b/u,
    /\bPino\b/u,
    /\byap\b/iu,
    /\bslopshop\b/iu,
    /\bHugging Face\b/u,
    /\bTensorRT\b/u,
    /\bvLLM\b/u,
    /\bCloudflare Pages\b/u,
    /\bHetzner\b/u,
    /\bVercel\b/u,
];

/** Residue of the corruption the repair pass fixed; none may return. */
export const CORRUPTION_TERMS = [
    /z\.item\(/u,
    /\bitem literal/u,
    /\bsource item\b/u,
    /\bitem keys\b/u,
    /package[- ]coordinator/u,
    /secret coordinator/u,
    /service-coordinator/u,
    /\baccess command\b/u,
    /\bplatform command\b/u,
    /\bsource command\b/u,
    /\bprocess command\b/u,
    /access-command/u,
    /\bproject operators\b/u,
    /\bproject controls\b/u,
    /\bproject regex\b/u,
    /\bproject Bash harnesses\b/u,
    /encodedBytes/u,
    /code: 'project'/u,
];

/** The language tags a fenced block may carry. */
export const FENCE_LANGUAGES = [
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'python',
    'py',
    'swift',
    'bash',
    'sh',
    'shell',
    'sql',
    'toml',
    'json',
    'jsonc',
    'yaml',
    'yml',
    'text',
    'plaintext',
    'markdown',
    'md',
    'html',
    'css',
    'dockerfile',
    'diff',
    'dotenv',
    'mermaid',
    'http',
    'xml',
    'plist',
    'ini',
    'nginx',
    'makefile',
    'console',
];

/** No corpus file exceeds this many lines. */
export const RULE_FILE_LINE_CEILING = 800;
