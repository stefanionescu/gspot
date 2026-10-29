import type { MinimumReleaseAge } from '#cli/types/installers/install.ts';

export const MINIMUM_RELEASE_AGE: MinimumReleaseAge = {
    days: 7,
    npmExclusions: ['@gspothq/eslint-plugin', 'eslint', 'prettier'],
    pythonExclusions: [],
};
