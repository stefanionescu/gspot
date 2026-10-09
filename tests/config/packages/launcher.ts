/** Authored input replaced or inspected by the delivered launcher scenario. */
export const LAUNCHER_FILES = {
    '.editorconfig': 'root = true\n[*]\nindent_size = 2\n[*.json]\nindent_size = 4\n',
    'prettier.config.mjs':
        'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n',
    'source.js': 'const greeting="hello";',
    'broken.sh': 'if then\n',
    'authored.txt': 'Preserve this authored file.\n',
    'AGENTS.md': '# Team notes\n',
    'CLAUDE.md': '# Claude notes\n\nRun the tests.\n',
};

/** Exact Bash diagnostics for the launcher's syntax sample. */
export const SYNTAX_FINDINGS = [
    {
        check: 'bash/bash-syntax',
        file: 'broken.sh',
        line: 1,
        message: "syntax error near unexpected token `then'",
    },
    { check: 'bash/bash-syntax', file: 'broken.sh', line: 1, message: "`if then'" },
];

/** Own record keys remain authored data in the installed CLI's native policy parser. */
export const RECORD_POLICY = `configurations = []
[words]
"__proto__" = "A reviewed project word."
[check."__proto__"]
stage = "commit"
paths = ["README.md"]
command = ["echo", "accepted"]
[tools.commitlint.rules]
"__proto__" = ["always"]
[reasons]
"tools.commitlint.rules.__proto__" = "The project uses this native rule option."
`;

/** Native validators refuse each malformed value rather than discarding its authored key. */
export const INVALID_RECORD_POLICIES = [
    { source: '[limits]\n"__proto__" = "invalid"\n', diagnostic: 'limits.__proto__' },
    { source: '[tools.commitlint.rules]\n"__proto__" = ["invalid"]\n', diagnostic: '--rule __proto__' },
    {
        source: '[tools.eslint.rules]\n"project/rule" = [{ "__proto__" = 2026-10-09 }]\n',
        diagnostic: 'ESLint rule selection',
    },
];
