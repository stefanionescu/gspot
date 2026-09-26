// The literal values agents reads: names, patterns, limits, and tables.

export const RULE_LINK =
    /\]\((?:\.\.\/)*(?:general|language|runtime|framework|library|tool|platform|database|shared|repository)\/[^)]+\.md\)/u;
export const INLINE_CODE = /`[^`]*`/u;
export const INLINE_CODE_SPANS = /`[^`]*`/gu;
export const EM_DASH = '—';
export const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/u;
export const ITEM_END = /[.!?]["')\]]*$/u;
export const AGENT_LAYERS = new Set(['general/agent', 'general/code', 'general/prose']);
export const RULES_PREFIX = 'packages/cli/rules/';
export const TITLE = /^# (?<title>.+)$/mu;
/** The files the managed block tells the reader to open first; they cannot be left out. */
export const FIRST_READ = ['general/agent/WORKING.md', 'general/prose/WRITING.md'];
export const AREA_BY_LAYER: Record<string, string> = {
    agent: 'How to work here',
    code: 'Code, everywhere',
    prose: 'Documentation',
    language: 'Languages',
    runtime: 'Runtimes',
    framework: 'Frameworks',
    library: 'Libraries',
    tool: 'Tools',
    platform: 'Platforms',
    database: 'Databases',
    shared: 'Shared',
    repository: 'Repository',
};
export const CHECKS_INSTALLED =
    'Run `gspot check --staged` before committing. Change policy with `gspot set` or `gspot ignore` (or by editing `gspot.toml`), then `gspot apply`; never edit files under `.gspot/`.';
export const RULES_ALONE =
    'These files are installed copies. Change `[rules]` in `gspot.toml` and run `gspot apply`, and never edit files under the rules directory.';
// A guide names one configuration or none.
export const CONFIGURATION_ID = /^(?:none|[a-z][a-z0-9-]*)$/u;
export const FENCE = '---';
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
