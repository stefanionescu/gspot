// The discovered Stylelint configuration the adoption tests start from.
import type { ExistingTooling } from '#cli/repository/existing-tooling.ts';

/** One discovered root Stylelint configuration and nothing else. */
export const STYLELINT_TOOLING: ExistingTooling = {
    configs: [{ tool: 'stylelint', path: '.stylelintrc.json', carries: 'rules-table', check: 'css/stylelint' }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};
