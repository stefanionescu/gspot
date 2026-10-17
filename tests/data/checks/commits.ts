import { LICENSE } from '#tests/data/checks/docs.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

export const COMMITLINT_EXECUTABLE = '.bin/commitlint';

/** Package fields that must stay when gspot replaces only the Commitlint field. */
export const COMMITLINT_PACKAGE =
    '{"name":"native-project","private":true,"commitlint":{"rules":{"type-enum":[2,"always",["special"]]}},"kept":[0,false,""]}\n';

/** Commit rules come from nested packages too; a package without the field stays unchanged. */
export const COMMITLINT_PROJECT = {
    'package.json': COMMITLINT_PACKAGE,
    'app/package.json': COMMITLINT_PACKAGE,
    'app/child/package.json': COMMITLINT_PACKAGE,
    'plain/package.json': '{"private":true}\n',
} as const;

/** Commit messages and the Commitlint rule each one breaks, if any. */
export const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'style(Core): format source', rule: undefined },
    { message: 'revert(Core): restore source', rule: undefined },
    { message: 'fix(root): repair the parser', rule: 'scope-enum' },
    { message: 'fix(hooks): repair the parser', rule: 'scope-enum' },
    { message: 'fix(deps): repair the parser', rule: 'scope-enum' },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
    { message: 'fix(Core): repair the parser.', rule: 'subject-full-stop' },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: undefined },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: 'header-max-length' },
] as const;

/** Commitlint module filenames for replacement checks. */
export const COMMITLINT_FILES = [
    { file: '.commitlintrc.mjs', source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    { file: '.commitlintrc.ts', source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    { file: '.commitlintrc.cts', source: 'module.exports = { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    { file: '.commitlintrc.mts', source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    {
        file: 'commitlint.config.cts',
        source: 'module.exports = { rules: { "type-enum": [2, "always", ["special"]] } };\n',
    },
    {
        file: 'commitlint.config.mts',
        source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n',
    },
] as const;

export const COMMITS_FILES = {
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'README.md': '# Test\n',
    LICENSE,
} as const;
