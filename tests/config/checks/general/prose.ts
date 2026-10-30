import { join } from 'node:path/posix';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const VALE_ALERT = {
    Line: 1,
    Span: [3, 5],
    Check: 'gspot.Example',
    Message: 'Use a concrete example.',
} as const;

export const VALE_SANDBOX_FILES = {
    [GSPOT_PATHS.valeConfigFile]: 'Packages =\n',
    'example.md': '# Documentation\n',
};

const VALE_COLON_PATH_FINDINGS = [
    {
        check: 'prose/vale',
        file: 'docs/café:part\nname.md',
        line: 3,
        column: 10,
        rule: 'gspot.marketing',
        message: 'Marketing word.',
        fixable: false,
    },
] as const;

const VALE_LOCATION_FINDINGS = [
    {
        check: 'prose/vale',
        file: 'docs/a.md',
        line: 3,
        column: 10,
        rule: 'gspot.marketing',
        message: "Marketing word 'robust'.",
        fixable: false,
    },
    {
        check: 'prose/vale',
        file: 'stdin.rb',
        line: 2,
        column: 5,
        rule: 'Google.We',
        message: 'Try not to use first-person plural.',
        fixable: false,
    },
] as const;

export const VALE_OUTPUT_CASES = [
    {
        name: 'file and stdin report locations',
        stdout: JSON.stringify({
            'docs/a.md': [{ Line: 3, Span: [10, 15], Check: 'gspot.marketing', Message: "Marketing word 'robust'." }],
            'stdin.rb': [{ Line: 2, Span: [5, 6], Check: 'Google.We', Message: 'Try not to use first-person plural.' }],
        }),
        findings: [...VALE_LOCATION_FINDINGS],
    },
    {
        name: 'control characters in report paths',
        stdout:
            JSON.stringify({
                [join('docs', 'café:part\nname.md')]: [
                    { Line: 3, Span: [10, 15], Check: 'gspot.marketing', Message: 'Marketing word.' },
                ],
            }) + '\r\n',
        findings: [...VALE_COLON_PATH_FINDINGS],
    },
] as const;

export const EMPTY_VALE_INI = 'Packages =\n';

export const VALE_INSTALLED_FILES = Object.fromEntries(
    ['Google', 'write-good', 'proselint', 'alex', 'Harper', 'config/dictionaries'].map((folder) => [
        `${GSPOT_PATHS.valePackages}/${folder}/.keep`,
        '',
    ]),
);
