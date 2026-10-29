import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { STYLELINT_FILES, COMMITLINT_PACKAGE } from '#tests/config/authored-config-files.ts';

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
};

export const STYLELINT_PACKAGE_FIELDS = {
    project: {
        ...STYLELINT_FILES,
        'app/child/source.css': 'a { opacity: 1; }\n',
        'other/source.css': 'a { opacity: 1; }\n',
    },
    configurations: ['css'],
    tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "other"\n',
    unchanged: ['plain/package.json'],
    changes: [
        { path: 'package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }] },
        { path: 'app/child/package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }] },
        {
            path: 'app/package.json',
            keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }],
        },
        { path: 'other/package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }] },
    ],
};

export const EDITED_COMMITLINT_PACKAGE =
    '{"name":"edited-project","private":true,"commitlint":{"extends":"../.gspot/configurations/general/commits/commitlint.json"},"kept":[0,false,""]}\n';

export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

export const TOOL_FOLDERS = [
    { kind: 'npm', folder: GSPOT_PATHS.nodeModules },
    { kind: 'python', folder: GSPOT_PATHS.pythonEnvironment },
    { kind: 'vale', folder: GSPOT_PATHS.valePackages },
] as const;
