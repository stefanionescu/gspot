import { COMMITLINT_PACKAGE } from '#tests/config/samples/commitlint.ts';

/** Repository-wide commit policy includes nested authored packages and leaves absent fields alone. */
export const COMMITLINT_PROJECT = {
    'package.json': COMMITLINT_PACKAGE,
    'app/package.json': COMMITLINT_PACKAGE,
    'app/child/package.json': COMMITLINT_PACKAGE,
    'plain/package.json': '{"private":true}\n',
};

/** Existing files that inactive all-level checks must leave authored at recommended. */
export const INACTIVE_CONFIGURATIONS = {
    '.commitlintrc.json': '{"rules":{}}\n',
    '.commitlintrc.mts': 'export default { rules: {} };\n',
    '.syncpackrc.json': '{"versionGroups":[]}\n',
    '.syncpackrc.yaml': 'versionGroups: []\n',
    'package.json': COMMITLINT_PACKAGE,
};

/** Scoped projects share the repository-wide commit policy. */
export const COMMITLINT_SCOPES = '[scope."app"]\n[scope."app/child"]\n';
