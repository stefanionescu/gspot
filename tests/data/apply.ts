import { STYLELINT_FILES } from '#tests/data/checks/css.ts';
import { COMMITLINT_PROJECT } from '#tests/data/checks/commits.ts';

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
