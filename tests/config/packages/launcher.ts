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
