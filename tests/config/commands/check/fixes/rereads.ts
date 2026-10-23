import { ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/config/repository/dependencies.ts';

export const CLEAR_DEPENDENCIES_SCRIPT = `require('node:fs').writeFileSync('package.json', ${JSON.stringify(ROOT_PACKAGE_WITHOUT_DEPENDENCIES)})`;
