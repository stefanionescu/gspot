import { STYLELINT_FILES } from '#tests/config/authored-config-files.ts';

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
        {
            path: 'app/child/package.json',
            keys: [
                {
                    key: ['stylelint'],
                    value: { extends: '../../.gspot/configurations/language/css/stylelint.json' },
                },
            ],
        },
        {
            path: 'app/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/language/css/stylelint.json' } }],
        },
        {
            path: 'other/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/language/css/stylelint.json' } }],
        },
    ],
};

export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;
