import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';
import { eslintResponse } from '#cli/evaluation/protocol.ts';
import type { CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import { carriedTool } from '#cli/policy/adoption/results.ts';
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';
import { basename } from 'node:path';

/**
 * Convert ESLint selectors and module registrations from observed configuration.
 * @param root
 * @param configs
 * @param paths
 * @param lists
 */
export async function collectEslint(
    root: string,
    configs: ExistingTooling['configs'],
    paths: string[],
    lists: CarriedConfiguration,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        if (configs.every(({ path }) => basename(path) === '.eslintignore'))
            throw new Error('ESLint ignore adoption requires the configuration that uses it.');
        const nestedIgnore = configs.find(({ path }) => basename(path) === '.eslintignore' && path.includes('/'));
        if (nestedIgnore !== undefined)
            throw new Error(
                `ESLint does not load ${nestedIgnore.path} from the repository root. Convert it before adoption.`,
            );
        const flat = configs.some(({ path }) => /(?:^|\/)eslint\.config\./u.test(path));
        if (flat && (configs.length !== 1 || first.path.includes('/')))
            throw new Error(
                `ESLint conversion requires one root configuration. Convert ${configs.map(({ path }) => path).join(', ')} before adoption.`,
            );
        const carried = eslintResponse.parse(
            await evaluateConfiguration({
                tool: 'eslint',
                operation: 'rules',
                root,
                paths,
                from: first.path,
                flat,
                configs: configs.map(({ path }) => path),
            }),
        );
        carriedTool(lists, 'eslint').settings['adopted'] = carried.adopted;
        for (const { path } of configs) {
            if (basename(path) === 'package.json')
                lists.retained.push({
                    path,
                    note: 'Package metadata retained; ESLint configuration is represented in gspot configuration',
                });
            else
                lists.removed.push({
                    path,
                    note: 'ESLint selectors, options, and module registrations are represented in gspot configuration',
                });
        }
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}
