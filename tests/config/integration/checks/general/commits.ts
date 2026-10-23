import { LICENSE } from '#tests/config/checks/samples.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';

export const COMMITLINT_EXECUTABLE = '.bin/commitlint';

export const COMMIT_MESSAGES = [
    { message: 'fix(Core): repair the parser', rule: undefined },
    { message: 'fix: repair the parser', rule: undefined },
    { message: 'style(Core): format source', rule: undefined },
    { message: 'revert(Core): restore source', rule: undefined },
    { message: 'feat(Core)!: drop the parser option', rule: undefined },
    { message: 'feat!: drop the parser option', rule: undefined },
    { message: 'fix(root): repair the parser', rule: 'scope-enum' },
    { message: 'fix(hooks): repair the parser', rule: 'scope-enum' },
    { message: 'fix(deps): repair the parser', rule: 'scope-enum' },
    { message: 'fix(core): repair the parser', rule: 'scope-enum' },
    { message: 'fix(Core): repair the parser.', rule: 'subject-full-stop' },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: undefined },
    { message: 'fix(Core): xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', rule: 'header-max-length' },
] as const;

export const COMMITS_FILES = {
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'README.md': '# Test\n',
    LICENSE,
} as const;

/**
 * The commitlint findings of a commit message with no type, one sentence such as `Bad message.`
 *
 * @param hash the commit.
 * @returns each rule with its message.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 1 file share it.
export function buildUntypedMessageFindings(hash: string): { rule: string; message: string }[] {
    return [
        { rule: 'type-empty', message: `${hash}: type may not be empty` },
        { rule: 'subject-empty', message: `${hash}: subject may not be empty` },
        { rule: 'subject-full-stop', message: `${hash}: subject may not end with full stop` },
    ];
}
