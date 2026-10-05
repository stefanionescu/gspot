import type { EslintPresetSources } from '#cli/types/generation/eslint.ts';

/** The core catalog shares the preset producer and exact tool pin. */
export const ESLINT_RULE_NAMES_FILE = 'configurations/language/javascript/eslint-rule-names.json';
export const ESLINT_RULE_NAMES_MODULE = 'eslint/use-at-your-own-risk';

/** Installed preset sources whose rule and file data is shipped with its owning configuration. */
export const ESLINT_PRESET_SOURCES: EslintPresetSources = {
    javascript: {
        eslint: ['@eslint/js', 'configs.recommended'],
        sonar: ['eslint-plugin-sonarjs', 'configs.recommended'],
        unicorn: ['eslint-plugin-unicorn', 'configs.recommended'],
        packageJson: ['eslint-plugin-package-json', 'configs.recommended'],
        prettier: ['eslint-config-prettier', ''],
        gspot: ['@gspothq/eslint-plugin', 'configs.recommended'],
    },
    typescript: {
        strict: ['typescript-eslint', 'configs.strictTypeChecked'],
        untyped: ['typescript-eslint', 'configs.disableTypeChecked'],
    },
    react: {
        recommended: ['eslint-plugin-react', 'configs.flat.recommended'],
        jsx: ['eslint-plugin-react', 'configs.flat.jsx-runtime'],
        hooks: ['eslint-plugin-react-hooks', 'configs.flat.recommended-latest'],
        refresh: ['eslint-plugin-react-refresh', 'configs.recommended'],
        testing: ['eslint-plugin-testing-library', 'configs.flat/react'],
    },
    'react-dom': { accessibility: ['eslint-plugin-jsx-a11y', 'flatConfigs.recommended'] },
    vue: {
        recommended: ['eslint-plugin-vue', 'configs.flat/recommended'],
        accessibility: ['eslint-plugin-vuejs-accessibility', 'configs.flat/recommended'],
        testing: ['eslint-plugin-testing-library', 'configs.flat/vue'],
    },
    svelte: {
        recommended: ['eslint-plugin-svelte', 'configs.recommended'],
        testing: ['eslint-plugin-testing-library', 'configs.flat/svelte'],
    },
    astro: {
        recommended: ['eslint-plugin-astro', 'configs.flat/recommended'],
        accessibility: ['eslint-plugin-astro', 'configs.flat/jsx-a11y-recommended'],
    },
    nextjs: {
        recommended: ['@next/eslint-plugin-next', 'configs.core-web-vitals'],
        refresh: ['eslint-plugin-react-refresh', 'configs.next'],
    },
    nestjs: {
        recommended: ['@darraghor/eslint-plugin-nestjs-typed', 'configs.flatRecommended'],
        noSwagger: ['@darraghor/eslint-plugin-nestjs-typed', 'configs.flatNoSwagger'],
    },
    'tanstack-query': { recommended: ['@tanstack/eslint-plugin-query', 'configs.flat/recommended'] },
    vitest: { recommended: ['@vitest/eslint-plugin', 'configs.recommended'] },
};
