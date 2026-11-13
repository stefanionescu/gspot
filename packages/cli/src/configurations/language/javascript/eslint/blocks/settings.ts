import { PACKAGE_JSON_PATTERN, PACKAGE_JSON_RULE_PREFIX } from '#cli/config/configurations/javascript/blocks.ts';
import { ESLINT_CHECK } from '#cli/config/configurations/javascript/eslint.ts';
import { buildLimitRuleBlocks } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';
import { buildManifestRuleBlocks } from '#cli/configurations/language/javascript/eslint/blocks/manifests.ts';
import {
    buildEnvironmentRuleBlocks,
    buildTrivialRuleBlocks,
} from '#cli/configurations/language/javascript/eslint/blocks/structure.ts';
import { buildScopeFiles, splitGlobs } from '#cli/configurations/language/javascript/eslint/files.ts';
import type { EslintBlockFields, EslintRuleBlock, PlannedEslintFile } from '#cli/types/configurations/javascript.ts';

function buildSettingsBlocks(planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session } = planned;
    const ignored = session.settings.ignore.flatMap((ignore): EslintRuleBlock[] =>
        ignore.rule === undefined || ignore.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scopePath: '',
                      ...splitGlobs(ignore.paths ?? ['**/*']),
                      rules: { [ignore.rule]: 'off' },
                  },
              ],
    );
    return [
        ...buildLimitRuleBlocks(planned),
        ...buildEnvironmentRuleBlocks(planned),
        ...buildTrivialRuleBlocks(planned),
        ...buildManifestRuleBlocks(session.scopes, session.repository.dependencyFiles),
        ...ignored,
    ];
}

export function splitSettingsBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles' | 'eslintFiles'>,
): EslintBlockFields[] {
    return buildSettingsBlocks(planned).flatMap(({ scopePath, includes, excludes, rules }) => {
        const rulePairs = Object.entries(rules);
        return [
            {
                files: buildScopeFiles(planned.eslintFiles.code, scopePath, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => !name.startsWith(PACKAGE_JSON_RULE_PREFIX))),
            },
            {
                files: buildScopeFiles([PACKAGE_JSON_PATTERN], scopePath, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => name.startsWith(PACKAGE_JSON_RULE_PREFIX))),
            },
        ].filter((block) => Object.keys(block.rules).length > 0);
    });
}
