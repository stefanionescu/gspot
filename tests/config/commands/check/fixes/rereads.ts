import { ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/config/repository/dependencies.ts';

/** A fixer script that writes a root package.json without dependencies. */
export const CLEAR_DEPENDENCIES_SCRIPT = `require('node:fs').writeFileSync('package.json', ${JSON.stringify(ROOT_PACKAGE_WITHOUT_DEPENDENCIES)})`;
