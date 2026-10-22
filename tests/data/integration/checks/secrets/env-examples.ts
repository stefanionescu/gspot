export const DOTENV_LINTER_SANDBOX = {
    install: false,
    configurations: ['secrets'],
    files: { '.env.example': 'PORT=3000\n' },
} as const;

export const DOTENV_LINTER_CASES = [
    {
        check: 'secrets/dotenv-linter',
        files: {
            '.env.example': `PORT=3000
port=3000
PORT=4000
`,
        },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
        corrected: { files: { '.env.example': 'PORT=3000\n' } },
    },
] as const;
