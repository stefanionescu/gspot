/** Native file selection and syntax diagnostics for each interpreter. */
export const SYNTAX_CASES = [
    {
        check: 'bash/bash-syntax',
        path: 'script.sh',
        files: ['launcher', 'script.sh'],
        broken: 'if then\n',
        line: 1,
        message: 'syntax',
    },
    // Zsh reports a parse error at the end of this one-line input, on line 2.
    {
        check: 'bash/zsh-syntax',
        path: 'script.zsh',
        files: ['script.zsh', 'zlauncher'],
        broken: 'if then\n',
        line: 2,
        message: 'parse error',
    },
    {
        check: 'bash/bats-syntax',
        path: 'script.bats',
        files: ['script.bats'],
        broken: '@test "broken" {\n    if then\n}\n',
        line: 2,
        message: 'syntax',
    },
];
