import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SYNTAX_RULE } from '#cli/config/configurations/infrastructure.ts';
import { REPOSITORY_RULES, OUTWARD_LINK_HELP, ABSOLUTE_LINK_HELP } from '#cli/config/configurations/structure.ts';

import {
    DOCS_RULES,
    YAML_RULES,
    LICENSE_RULES,
    YAML_MESSAGES,
    DEPENDENCY_RULES,
    type MESSAGE_REFERENCES,
} from '#cli/config/configurations/general.ts';

export const SYNTAX_RULE_DOCS = {
    [SYNTAX_RULE]: {
        description: 'A file that the check reads parses without errors.',
        why: 'The check cannot judge a file that it cannot parse.',
        fix: 'Fix the syntax at the reported line, then run the check again.',
        example: 'A JSON file that ends after `{ "name": "app"` reports `syntax`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

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

export const YAML_RULE_DOCS = {
    [YAML_RULES.syntax]: {
        description: 'YAML must parse without syntax errors.',
        why: 'A consumer cannot read malformed YAML.',
        fix: 'Fix the syntax at the reported line, then check the file again.',
        example: '`items: [` needs a closing bracket, such as `items: []`.',
    },
    [YAML_RULES.duplicate]: {
        description: 'Each mapping key appears once.',
        why: 'Consumers can reject duplicate keys or silently discard one value.',
        fix: 'Keep one definition of the key and remove the other.',
        example: 'Replace two `enabled:` entries in the same mapping with one.',
    },
    [YAML_RULES.anchors]: {
        description: 'Aliases name preceding anchors in the same document, and every anchor has a use.',
        why: 'An undefined alias has no value, and an unused anchor adds misleading structure.',
        fix: 'Declare the anchor before its alias, or remove the unused anchor.',
        example: '`timeout: &request-timeout 30` followed by `retry_timeout: *request-timeout` shares one value.',
    },
    [YAML_RULES.truthy]: {
        description: 'Boolean-looking strings are quoted, and booleans use lowercase true or false.',
        why: 'YAML versions disagree about whether yes, no, on, and off are strings or booleans.',
        fix: YAML_MESSAGES.truthy,
        example: 'Write `answer: "yes"` for a string or `enabled: true` for a boolean.',
    },
    [YAML_RULES.octal]: {
        description: 'Plain numbers have no leading zero or octal prefix.',
        why: 'YAML versions can read the same leading-zero value as different numbers.',
        fix: YAML_MESSAGES.octal,
        example: 'Write `mode: "0755"` when the exact digits matter.',
    },
    [YAML_RULES.documents]: {
        description: 'A file contains one YAML document.',
        why: 'A consumer that reads one document can miss the rest of a stream.',
        fix: YAML_MESSAGES.documents,
        example: 'Split documents separated by `---` into separate files unless the consumer requires a stream.',
    },
    [YAML_RULES.merge]: {
        description: 'Mappings have explicit keys instead of the << merge key.',
        why: 'YAML 1.2 does not define merge keys, and consumers can ignore them.',
        fix: YAML_MESSAGES.merge,
        example: 'Replace `<<: *defaults` with the mapping keys the consumer needs.',
    },
    [YAML_RULES.anchorNames]: {
        description: 'An anchor name describes the value it holds.',
        why: 'Generated names hide the relationship between the anchor and its aliases.',
        fix: 'Rename the anchor and its aliases for their shared value.',
        example: 'Replace `&a1` and `*a1` with `&request-timeout` and `*request-timeout`.',
    },
    [YAML_RULES.version]: {
        description: 'A decimal-looking string with a trailing zero is quoted.',
        why: 'A numeric parser discards the trailing zero of a value such as 1.10.',
        fix: YAML_MESSAGES.version,
        example: 'Write `version: "1.10"` to keep the complete version string.',
    },
    [YAML_RULES.comments]: {
        description: 'Comments sit above the key, except version comments after pinned actions.',
        why: 'A comment above a key stays separate from its value.',
        fix: YAML_MESSAGES.comments,
        example: 'Move `enabled: true # required` to a comment line above `enabled: true`.',
    },
    [YAML_RULES.extension]: {
        description: 'YAML files use .yml unless a consumer names the .yaml file.',
        why: 'One extension keeps file discovery predictable while preserving required tool names.',
        fix: YAML_MESSAGES.extension,
        example: 'Rename `settings.yaml` to `settings.yml`; keep `pnpm-workspace.yaml`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const LOCKFILE_RULE_DOCS = {
    [DEPENDENCY_RULES.host]: {
        description: 'Each download URL of a JavaScript lockfile uses HTTPS and a host of `allowed_registries`.',
        why: 'A package from another host, or over plain HTTP, can differ from the package the team reviewed.',
        fix: 'Install the package from an allowed registry, or add its host to `dependencies.allowed_registries`.',
        example: 'A `resolved` URL that starts with `http://` reports `host`.',
    },
    [DEPENDENCY_RULES.foreignLockfile]: {
        description: 'A scope holds the lockfile of one JavaScript package manager.',
        why: 'Each package manager reads only its own lockfile, so two lockfiles record two dependency trees.',
        fix: 'Keep the lockfile of the package manager that the scope uses, and delete the others.',
        example: '`package-lock.json` beside `pnpm-lock.yaml` reports `foreign-lockfile`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const PACKAGE_MANAGER_PIN_DOCS = {
    [DEPENDENCY_RULES.packageManagerPin]: {
        description: '`packageManager` in `package.json` names the version of the package manager that mise pins.',
        why: 'CI installs the version that `packageManager` names, so another local version can write another lockfile.',
        fix: 'Change `packageManager` or the mise pin, so that both name one version.',
        example: '`"packageManager": "pnpm@9.1.0"` beside a mise pin of pnpm 9.4.0 reports `package-manager-pin`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const MISSING_PATH_RULE_DOCS = {
    [DOCS_RULES.missingPath]: {
        description: 'Each path in Markdown prose or in a shell code block leads to a tracked file or folder.',
        why: 'A reader who follows a missing path finds nothing.',
        fix: 'Correct the path, or put example paths in a code block with a `title=` attribute.',
        example: '`Edit src/old-name.ts` after a rename to `src/name.ts` reports `missing-path`.',
    },
    [DOCS_RULES.missingTask]: {
        description: 'Each `mise run`, `npm run`, `pnpm run`, `yarn run`, or `bun run` runs a task that exists.',
        why: 'A reader who runs a missing task gets an error.',
        fix: 'Correct the task name, or add the task.',
        example: '`mise run tests` in a project whose task is `test` reports `missing-task`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const REQUIRED_FILE_RULE_DOCS = {
    [DOCS_RULES.missingReadme]: {
        description: 'Each scope has a `README.md`.',
        why: 'A reader of the scope needs to know what it does and how to start.',
        fix: 'Add a `README.md` that says what the scope does and how to start.',
        example: 'A scope `packages/api` without `packages/api/README.md` reports `missing-readme`.',
    },
    [DOCS_RULES.missingLicense]: {
        description: 'The repository root has a license file.',
        why: 'Without a license, a reader does not know whether they may use the code.',
        fix: 'Add a `LICENSE` file at the repository root.',
        example: 'A repository with only `docs/LICENSE` reports `missing-license`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const LICENSE_RULE_DOCS = {
    [LICENSE_RULES.disallowedLicense]: {
        description: 'Each locked package reports a license that `licenses.allowed` lists.',
        why: 'A license outside the list can bind the project to terms that the team did not accept.',
        fix: 'Replace the package, allow its license, or accept the package in a `[[licenses.allowed_package]]` record.',
        example: 'A package under `AGPL-3.0` while `licenses.allowed` lists `MIT` reports `disallowed-license`.',
    },
    [LICENSE_RULES.unusedRecord]: {
        description: 'Each `[[licenses.allowed_package]]` record matches a locked package.',
        why: 'A record that matches nothing stays in `gspot.toml` after its package is gone.',
        fix: 'Delete the record, or fix the package name or version range that it gives.',
        example: 'A record for `left-pad` after the lockfile drops `left-pad` reports `unused-record`.',
    },
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

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
