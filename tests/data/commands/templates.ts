import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

// Templates carry root customizations and omit only the source repository's scopes.
export const TEMPLATE_CUSTOMIZATIONS = `\n[[command_check]]\nname = "sandbox/pass"\ncommand = ["bun", "-e", "process.exit(0)"]\npaths = ["scripts/**"]\nstage = "manual"\n\n[[scope]]\npath = "app"\n\nconfigurations = ["bash"]\n`;

export const TEMPLATE_IGNORES = [
    { rule: 'SC2086', reason: 'A path entry that stays here.', paths: ['--paths', 'scripts/**'] },
    { rule: 'SC2034', reason: 'The shell exports these variables to another process.', paths: [] },
] as const;

export const DESTINATION_FILES = {
    'tools/b.sh': CLEAN_BASH_SCRIPT,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'index.ts': 'export const b = 1;\n',
    '.shellcheckrc': 'disable=SC2154\n',
} as const;

export const DESTINATION_CONFIGURATIONS = ['bash', 'typescript'] as const;

export const TEMPLATE_FILE = 'house.template.toml';

export const TEMPLATE_SHELLCHECK_CASES = [
    { files: { 'tools/b.sh': '#!/usr/bin/env bash\nunused_variable=hello\n' }, code: 0 },
    { files: { 'tools/b.sh': '#!/usr/bin/env bash\necho $unquoted\n' }, code: 1 },
    {
        files: {
            'tools/b.sh': CLEAN_BASH_SCRIPT,
            'scripts/a.sh': '#!/usr/bin/env bash\nunquoted="hello world"\necho $unquoted\n',
        },
        code: 0,
    },
] as const;
