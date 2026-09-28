import { basename } from 'node:path';
import { eslintResponse } from '#cli/evaluation/protocol.ts';
import { adoptedTool } from '#cli/policy/adoption/results.ts';
import type { AdoptionResult } from '#cli/types/policy/adoption.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';
import type { ExistingTooling } from '#cli/types/repository/repository.ts';

// Reject ambiguous source trees before choosing the native ESLint configuration format.
function validateEslintSources(configs: ExistingTooling['configs']): boolean {
    if (configs.every(({ path }) => basename(path) === '.eslintignore'))
        throw new Error('ESLint ignore adoption requires the configuration that uses it.');
    const nestedIgnore = configs.find(({ path }) => basename(path) === '.eslintignore' && path.includes('/'));
    if (nestedIgnore !== undefined)
        throw new Error(
            `ESLint does not load ${nestedIgnore.path} from the repository root. Convert it before adoption.`,
        );
    const flat = configs.some(({ path }) => /(?:^|\/)eslint\.config\./u.test(path));
    if (flat && (configs.length !== 1 || configs.some(({ path }) => path.includes('/'))))
        throw new Error(
            `ESLint conversion requires one root configuration. Convert ${configs.map(({ path }) => path).join(', ')} before adoption.`,
        );
    return flat;
}

/**
 * Convert ESLint selectors and module registrations from observed configuration.
 * @param root the repository root
 * @param configs the ESLint configuration files found
 * @param paths the tracked source paths
 * @param lists the carried configuration the selectors and registrations are added to
 */
export async function collectEslint(
    root: string,
    configs: ExistingTooling['configs'],
    paths: string[],
    lists: AdoptionResult,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        const flat = validateEslintSources(configs);
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
        adoptedTool(lists, 'eslint').settings['adopted'] = carried.adopted;
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
