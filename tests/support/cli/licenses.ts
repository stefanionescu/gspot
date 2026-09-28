import { createFileTree } from 'testdirs';
import { delimiter, join } from 'node:path';
import { commitAll } from '#tests/support/cli/git.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the licenses configuration: a package under a license outside the list, and an exception that went stale.
import { ROOT } from '#tests/constants/acceptance/source/configurations/configurations.ts';
import { LICENSES_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';

const NPM_BIN = join(import.meta.dir, '../../../node_modules/.bin');

/** Creates installed license metadata and selects the package license check. */
export async function prepareLicenseProject(root: string) {
    await createFileTree(root, {
        'package.json': ROOT,
        '.gitignore': 'node_modules/\n',
        'node_modules/kind/package.json': JSON.stringify({ name: 'kind', version: '1.0.0', license: 'MIT' }),
        'node_modules/choice/package.json': JSON.stringify({
            name: 'choice',
            version: '1.0.0',
            license: 'MIT OR (GPL-3.0-only AND GPL-2.0-only)',
        }),
        'node_modules/combined/package.json': JSON.stringify({
            name: 'combined',
            version: '1.0.0',
            license: 'MIT AND (Apache-2.0 OR GPL-3.0-only)',
        }),
    });
    commitAll(root);
    const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['typos', 'ec'])}` };
    await installAtLevel(root, LICENSES_INIT, environment);
    return environment;
}
