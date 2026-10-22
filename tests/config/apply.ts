import { STYLELINT_FILES } from '#tests/config/checks/language/css.ts';
import { COMMITLINT_PACKAGE } from '#tests/config/checks/general/commits.ts';

/** Commit rules come from nested packages too; a package without the field stays unchanged. */
const COMMITLINT_PROJECT = {
    'package.json': COMMITLINT_PACKAGE,
    'app/package.json': COMMITLINT_PACKAGE,
    'app/child/package.json': COMMITLINT_PACKAGE,
    'plain/package.json': '{"private":true}\n',
} as const;

export const COMMITLINT_PACKAGE_FIELDS = {
    project: COMMITLINT_PROJECT,
    configurations: [],
    tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n',
    unchanged: ['plain/package.json'],
    changes: [
        {
            path: 'package.json',
            keys: [
                {
                    key: ['commitlint'],
                    value: { extends: './.gspot/configurations/general/commits/commitlint.json' },
                },
            ],
        },
        {
            path: 'app/child/package.json',
            keys: [
                {
                    key: ['commitlint'],
                    value: { extends: '../../.gspot/configurations/general/commits/commitlint.json' },
                },
            ],
        },
        {
            path: 'app/package.json',
            keys: [
                {
                    key: ['commitlint'],
                    value: { extends: '../.gspot/configurations/general/commits/commitlint.json' },
                },
            ],
        },
    ],
} as const;

export const STYLELINT_PACKAGE_FIELDS = {
    project: STYLELINT_FILES,
    configurations: ['css'],
    tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "other"\n',
    unchanged: ['plain/package.json', 'app/child/package.json', 'other/package.json'],
    changes: [
        { path: 'package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.json' } }] },
        {
            path: 'app/package.json',
            keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.json' } }],
        },
    ],
} as const;

/** An authored name edit that keeps the generated commitlint field. */
export const EDITED_COMMITLINT_PACKAGE =
    '{"name":"edited-project","private":true,"commitlint":{"extends":"../.gspot/configurations/general/commits/commitlint.json"},"kept":[0,false,""]}\n';

/** A file that changes between the init plan and the write: an edited package.json field. */
export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

/** The tool folders that apply deletes when no configuration needs them. */
export const TOOL_FOLDERS = [
    { kind: 'npm', folder: '.gspot/node_modules' },
    { kind: 'python', folder: '.gspot/.venv' },
    { kind: 'vale', folder: '.gspot/vale' },
] as const;
