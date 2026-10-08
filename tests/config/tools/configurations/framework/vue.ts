import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/config/samples/components.ts';

/** The consumer version installed only in native Vue sandboxes. */
export const VUE_VERSION = '3.5.22';

export const VUE_CLEAN =
    '<script setup lang="ts">\ndefineProps<{ name: string }>();\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n';

export const REPOSITORY: RepositoryScenario = {
    modules: false,
    configurations: ['typescript', 'vue', 'css'],
    tsconfig: COMPONENT_TSCONFIG,
    dependencies: { vue: VUE_VERSION },
    files: {
        'src/answer.ts': COMPONENT_SOURCE,
        'src/env.d.ts': "import 'vue';\n",
        'src/UserGreeting.vue': VUE_CLEAN,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: {
            'src/SharedPolicy.vue':
                '<script lang="ts">\nfunction forward(value: any) { return build(value); }\n</script>\n',
        },
        expected: {
            file: 'src/SharedPolicy.vue',
            rule: 'gspot/no-trivial-functions',
            line: 2,
        },
        corrected: {
            files: {
                'src/SharedPolicy.vue':
                    '<script setup lang="ts">\nconst answer = 42;\n</script>\n<template><p>{{ answer }}</p></template>\n',
            },
        },
    },
    {
        check: 'css/stylelint',
        files: {
            'src/Card.vue':
                '<template>\n    <p class="card"><span class="title">card</span></p>\n</template>\n\n<style scoped>\n.card :deep(.title) {\n    color: #ggg;\n    background-color: v-bind(themeColor);\n}\n</style>\n',
        },
        expected: {
            file: 'src/Card.vue',
            rule: 'declaration-property-value-no-unknown',
            line: 7,
        },
        corrected: {
            files: {
                'src/Card.vue':
                    '<template>\n    <p class="card"><span class="title">card</span></p>\n</template>\n\n<style scoped>\n.card :deep(.title) {\n    color: #abc;\n    background-color: v-bind(themeColor);\n}\n</style>\n',
            },
        },
    },
    {
        check: 'css/stylelint',
        files: {
            'src/Keyword.vue':
                '<style>\na {\n    color: RED;\n    background-color: v-bind(themeColor);\n}\n</style>\n',
        },
        expected: {
            file: 'src/Keyword.vue',
            rule: 'value-keyword-case',
            line: 3,
        },
        corrected: {
            files: {
                'src/Keyword.vue':
                    '<style>\na {\n    color: red;\n    background-color: v-bind(themeColor);\n}\n</style>\n',
            },
        },
    },
    {
        check: 'vue/vue-tsc',
        files: {
            'src/Count.vue':
                '<script setup lang="ts">\nconst count: number = \'one\';\n</script>\n\n<template>\n    <p>{{ count }}</p>\n</template>\n',
        },
        expected: {
            file: 'src/Count.vue',
            rule: 'TS2322',
            line: 2,
        },
        corrected: {
            files: {
                'src/Count.vue':
                    '<script setup lang="ts">\nconst count: number = 1;\n</script>\n\n<template>\n    <p>{{ count }}</p>\n</template>\n',
            },
        },
    },
];
