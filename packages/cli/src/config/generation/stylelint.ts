import type { StylelintComponent } from '#cli/types/generation/files.ts';
import { VUE_CONFIGURATION, SVELTE_CONFIGURATION } from '#cli/config/configurations.ts';
import { VUE_STYLELINT_OVERRIDE, SVELTE_STYLELINT_OVERRIDE } from '#cli/config/generation/settings.ts';

export const STYLELINT_COMPONENTS: Readonly<Record<string, StylelintComponent>> = {
    [VUE_CONFIGURATION]: VUE_STYLELINT_OVERRIDE,
    [SVELTE_CONFIGURATION]: SVELTE_STYLELINT_OVERRIDE,
};
