import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/components.ts';

export const VUE_SANDBOX = {
    configurations: ['typescript', 'vue', 'css'],
    tsconfig: COMPONENT_TSCONFIG,
    files: {
        'src/answer.ts': ANSWER_MODULE,
        'src/env.d.ts': "import 'vue';\n",
        'src/UserGreeting.vue': `<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<template>
    <p>{{ name }}</p>
</template>
`,
    },
} as const;

export const VUE_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/SharedPolicy.vue': `<script lang="ts">
function forward(value: any) { return build(value); }
</script>
`,
        },
        expected: {
            file: 'src/SharedPolicy.vue',
            rule: 'gspot/no-trivial-functions',
            line: 2,
        },
        corrected: {
            files: {
                'src/SharedPolicy.vue': `<script setup lang="ts">
const answer = 42;
</script>
<template><p>{{ answer }}</p></template>
`,
            },
        },
    },
    {
        check: 'css/stylelint',
        files: {
            'src/Card.vue': `<template>
    <p class="card"><span class="title">card</span></p>
</template>

<style scoped>
.card :deep(.title) {
    color: #ggg;
    background-color: v-bind(themeColor);
}
</style>
`,
        },
        expected: {
            file: 'src/Card.vue',
            rule: 'declaration-property-value-no-unknown',
            line: 7,
        },
        corrected: {
            files: {
                'src/Card.vue': `<template>
    <p class="card"><span class="title">card</span></p>
</template>

<style scoped>
.card :deep(.title) {
    color: #abc;
    background-color: v-bind(themeColor);
}
</style>
`,
            },
        },
    },
    {
        check: 'css/stylelint',
        files: {
            'src/Keyword.vue': `<style>
a {
    color: RED;
    background-color: v-bind(themeColor);
}
</style>
`,
        },
        expected: {
            file: 'src/Keyword.vue',
            rule: 'value-keyword-case',
            line: 3,
        },
        corrected: {
            files: {
                'src/Keyword.vue': `<style>
a {
    color: red;
    background-color: v-bind(themeColor);
}
</style>
`,
            },
        },
    },
    {
        check: 'vue/vue-tsc',
        files: {
            'src/Count.vue': `<script setup lang="ts">
const count: number = 'one';
</script>

<template>
    <p>{{ count }}</p>
</template>
`,
        },
        expected: {
            file: 'src/Count.vue',
            rule: 'TS2322',
            line: 2,
        },
        corrected: {
            files: {
                'src/Count.vue': `<script setup lang="ts">
const count: number = 1;
</script>

<template>
    <p>{{ count }}</p>
</template>
`,
            },
        },
    },
] as const;
