/** Authored input replaced or inspected by the delivered launcher scenario. */
export const LAUNCHER_FILES = {
    '.editorconfig': 'root = true\n[*]\nindent_size = 2\n[*.json]\nindent_size = 4\n',
    'prettier.config.mjs':
        'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n',
    'source.js': 'const greeting="hello";',
    'broken.sh': 'if then\n',
    'AGENTS.md': '# Team notes\n',
    'CLAUDE.md': '# Claude notes\n\nRun the tests.\n',
};

/** Exact checks that report the delivered consumer's test defects. */
export const EXPECTED_FAILURES = [
    'bash/shellcheck',
    'bash/shfmt',
    'bash/syntax',
    'dependencies/lockfile-hosts',
    'format/editorconfig-checker',
    'format/prettier',
];
