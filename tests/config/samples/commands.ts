import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';

/** Report selected paths and fail. */
export const REPORT_PROGRAM = 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;';

export const PROJECT_TRIGGERS = [
    ['delete', 'staged'],
    ['rename', 'changed'],
] as const;

export const PROJECT_OPTIONS = { stage: 'commit' as const, skips: [], only: ['sandbox/project'] };

export const NESTED_POLICY = `configurations = []
[scope."api"]
configurations = []
[scope."web"]
configurations = []
`;

export const EXCEPTION_REASON = 'The project contract requires this reviewed exception.';

export const INIT_ORIGINALS = {
    'typos.toml': '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\n',
    '.shellcheckrc': 'disable=SC2086,SC2034\n',
    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
    '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
    '.prettierrc': '{ "semi": false }\n',
};

export const INIT_FILES = {
    ...INIT_ORIGINALS,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'src/a.js': 'export const a = 1;\n',
    'README.md': '# test\n',
    'quality/lint.sh': CLEAN_BASH_SCRIPT,
};
