import type { LintRuleDocs } from '#cli/types/tools.ts';
import type { MESSAGE_REFERENCES } from '#cli/config/configurations/general.ts';

export const REFERENCE_RULE_DOCS = {
    'session-link': {
        description: 'No line of the commit message links to an AI chat session.',
        why: 'Nobody else can open the chat, and the link exposes it to every reader of the history.',
        fix: 'Remove the link, and describe the change in the message itself.',
        example: 'A `Claude-Session:` trailer reports `session-link`.',
    },
    'finding-id': {
        description: 'No line names a finding ID, such as `AB12-SEC-3`.',
        why: 'The ID points into a report that readers of the repository do not have.',
        fix: 'Replace the ID with a description of the change.',
        example: '`fix: close AB12-SEC-3` reports `finding-id`; `fix: escape the search query` does not.',
    },
    'plan-step': {
        description: 'No line names a step of a plan, such as `step 2.1`.',
        why: 'The plan stays outside the repository, so the step means nothing to a reader.',
        fix: 'Replace the step with a description of the change.',
        example: '`feat: finish step 2.1` reports `plan-step`.',
    },
    'home-path': {
        description: 'No line names a path inside a home folder, such as `/home/<name>/`.',
        why: 'The path exists on one machine only, and it shows a user name.',
        fix: 'Write the path from the repository root.',
        example: 'A path that starts with `/home/` and a user name reports `home-path`; `src/main.ts` does not.',
    },
    'issue-footer': {
        description: 'A `Refs:` or `Closes:` footer names an issue number.',
        why: 'A footer without a number links to nothing.',
        fix: 'Add the issue number, such as `Closes: #42`, or delete the footer.',
        example: '`Refs: the login bug` reports `issue-footer`; `Refs: #123` does not.',
    },
    'ci-skip': {
        description: 'No line holds a marker that stops CI, such as `[skip ci]`.',
        why: 'The commit then lands without the checks that CI runs.',
        fix: 'Delete the marker, so that CI runs on the commit.',
        example: '`docs: fix a typo [skip ci]` reports `ci-skip`.',
    },
} as const satisfies Readonly<Record<(typeof MESSAGE_REFERENCES)[number]['rule'], LintRuleDocs>>;
