import { join } from 'node:path/posix';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GUIDE, README, LICENSE } from '#tests/config/checks/samples.ts';

export const VALE_ALERT = {
    Line: 1,
    Span: [3, 5],
    Check: 'gspot.Example',
    Message: 'Use a concrete example.',
} as const;

/** A Markdown sandbox for the tests of valid and refused Vale output. */
export const VALE_SANDBOX_FILES = {
    'gspot.toml': buildSandboxSettings(['prose', 'markdown']),
    '.gspot/configurations/general/prose/vale.ini': 'Packages =\n',
    'example.md': '# Documentation\n',
};

/** The Vale finding of a file name with a colon and a newline. */
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

/** The Vale findings with file and stdin locations. */
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

/** Vale output cases with the findings that gspot reads from them. */
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
    { name: 'empty reports', stdout: '{}', findings: [] },
] as const;

export const PROSE_SANDBOX = {
    configurations: ['prose'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;
