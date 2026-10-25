import { CLEAN_BASH_SCRIPT } from '#tests/config/samples.ts';

const REPLACED_CONFIG_FILES = {
    'typos.toml': `[default.extend-words]
# The device identifier API name.
udid = "udid"
`,
    '.shellcheckrc': 'disable=SC2086,SC2034\n',
    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
    '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
    '.prettierrc': '{ "semi": false }\n',
} as const;

export const INIT_FILES = {
    ...REPLACED_CONFIG_FILES,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'src/a.js': 'export const a = 1;\n',
    'README.md': '# test\n',
    'quality/lint.sh': CLEAN_BASH_SCRIPT,
} as const;
