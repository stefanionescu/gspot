// What the rule lint of this repository refuses. None of this ships in the binary (D-86).

/** The layers a rule file can declare. */
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

/** Malformed technical terms that change the meaning of agent instructions. */
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

/** No rule file exceeds this many lines. */
export const RULE_FILE_LINE_CEILING = 800;

/** What ties a rule file to gspot or claims enforcement; a rule file stands without either (D-81). */
export const INDEPENDENCE_TERMS = [
    /\bgspot\b/iu,
    /\bthe gate\b/iu,
    /\benforced by\b/iu,
    /\b(?:structure|naming|prose|integrity) engine\b/iu,
    /\[(?:tools|limits|naming|structure|architecture|format)[.\] ]/u,
];
