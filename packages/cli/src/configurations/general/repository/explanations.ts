import type { LintRuleDocs } from '#cli/types/tools.ts';
import { REPOSITORY_RULES, OUTWARD_LINK_HELP, ABSOLUTE_LINK_HELP } from '#cli/config/configurations/structure.ts';

export const ENCODING_RULE_DOCS = {
    [REPOSITORY_RULES.encoding]: {
        description: 'Each tracked text file is UTF-8.',
        why: 'A tool that reads UTF-8 garbles or rejects text in another encoding.',
        fix: 'Convert the file to UTF-8 in an editor or with `iconv`.',
        example: 'A `README.md` saved as UTF-16 reports `encoding`.',
    },
    [REPOSITORY_RULES.pathEncoding]: {
        description: 'Each tracked path is UTF-8.',
        why: 'Another system or tool cannot read a path in another encoding.',
        fix: 'Give the file a name that is valid UTF-8, such as a name in plain ASCII.',
        example: 'A file name in Latin-1 bytes reports `path-encoding`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const LOCAL_FILE_RULE_DOCS = {
    [REPOSITORY_RULES.trackedFile]: {
        description: 'Git tracks no file that a selected configuration declares local, such as `.env`.',
        why: 'A local file holds the settings or secrets of one machine, and a commit shares them.',
        fix: 'Run `git rm --cached <path>`, and list the path in `.gitignore`.',
        example: '`.env` in the index reports `tracked-file`; `.env.example` does not.',
    },
    [REPOSITORY_RULES.absoluteLink]: {
        description: 'Each symbolic link has a relative target.',
        why: 'An absolute target exists only on the machine that made the link.',
        fix: ABSOLUTE_LINK_HELP,
        example: 'A link `config` to `/opt/app/config` reports `absolute-link`.',
    },
    [REPOSITORY_RULES.outwardLink]: {
        description: 'Each symbolic link points inside the repository.',
        why: 'A target outside the repository is missing in every other clone.',
        fix: OUTWARD_LINK_HELP,
        example: 'A link `shared` to `../../other-repository/shared` reports `outward-link`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
