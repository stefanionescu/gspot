export const STARTING_FILES = {
    '.editorconfig': `root = true
[*]
indent_size = 2
[*.json]
indent_size = 4
`,
    'prettier.config.mjs':
        'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n',
    'source.js': 'const greeting="hello";',
    'broken.sh': 'if then\n',
    'authored.txt': 'Preserve this authored file.\n',
    'AGENTS.md': '# Team notes\n',
    'CLAUDE.md': `# Claude notes

Run the tests.
`,
} as const;

export const SHELLCHECK_SYNTAX_FINDINGS = [
    {
        check: 'bash/shellcheck',
        file: 'broken.sh',
        line: 1,
        column: 1,
        rule: 'SC1073',
        message: "Couldn't parse this if expression. Fix to allow more checks.",
        fixable: false,
    },
    {
        check: 'bash/shellcheck',
        file: 'broken.sh',
        line: 1,
        column: 8,
        rule: 'SC1072',
        message: 'Unexpected keyword/token. Fix any mentioned problems and try again.',
        fixable: false,
    },
] as const;
