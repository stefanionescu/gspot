export const STYLELINT_PACKAGE_JSON = `{
  "name": "native-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

export const STYLELINT_FILES = {
    'package.json': STYLELINT_PACKAGE_JSON,
    'source.css': 'a { opacity: 1; }\n',
    'app/package.json': STYLELINT_PACKAGE_JSON,
    'app/source.css': 'a { opacity: 1; }\n',
    'app/child/package.json': STYLELINT_PACKAGE_JSON,
    'other/package.json': STYLELINT_PACKAGE_JSON,
    'plain/package.json': '{"private":true}\n',
} as const;

export const COMMITLINT_PACKAGE =
    '{"name":"native-project","private":true,"commitlint":{"rules":{"type-enum":[2,"always",["special"]]}},"kept":[0,false,""]}\n';
