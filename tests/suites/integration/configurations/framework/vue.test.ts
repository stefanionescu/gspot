import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/config/integration/general.ts';

const VUE_SANDBOX = {
    configurations: ['typescript', 'vue', 'css'],
    json: { 'tsconfig.json': COMPONENT_TSCONFIG },
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

const VUE_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/SharedPolicy.vue': `<script setup lang="ts">
function shout(text: string): string { return text.toUpperCase(); }
</script>

<template>
    <p>{{ shout('hello') }}</p>
</template>
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

const installedSandbox = shareInstalledSandbox({
    ...VUE_SANDBOX,
    dependencies: { vue: SANDBOX_PACKAGES.vue },
});

test.each([...VUE_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
