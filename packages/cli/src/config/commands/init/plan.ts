import { GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

export const COLUMN_GAP = 2;

export const CONFIGURATION_WIDTH = 16;

export const ORIGIN_WIDTH = 12;

export const ATTRIBUTES_ROW = {
    path: GITATTRIBUTES_FILE,
    note: 'marks the generated files and keeps LF line endings',
} as const;

export const CI_FILE_NOTES = {
    [GITHUB_WORKFLOW]: 'check workflow',
    [GITLAB_WORKFLOW]: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml`,
} as const;

export const GSPOT_FOLDER_NOTE = 'generated files';

export const UNREAD_SUBMODULE_MESSAGE = 'submodule; init does not read it';

export const LINT_FOLDER_MESSAGE = 'a folder of lint scripts; check remaining references before deleting it';

export const DELETED_RULES_NOTE =
    '(your own lint rules in them do not carry over; read them with git show HEAD:<path>)';

export const LINT_FOLDERS_HEADING = 'lint folders; delete when nothing calls them';

export const CHANGE_LATER_MESSAGE =
    'Change the hooks and rule files later with gspot set hooks.enabled or rules.enabled.';

export const TOOL_PIN_NOUN = 'tool pin';

export const NPM_PIN_NOUN = 'pinned npm tool';

export const PYTHON_PIN_NOUN = 'pinned Python tool';

export const CI_FILE_NOTE = 'existing CI file';

export const CI_OFF_MESSAGE =
    'CI is off. To turn it on, run gspot set ci.enabled true; for GitLab, also run gspot set ci.provider gitlab.';
