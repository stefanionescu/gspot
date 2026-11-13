import { noVueUpdatedWrites } from '#eslint-plugin/rules/vue/no-vue-updated-writes.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-vue-updated-writes', noVueUpdatedWrites, {
    valid: [
        ...[
            'onUpdated(() => { count.value = 1; });',
            'onUpdated(() => { count.value = count.value; });',
            'onUpdated(() => { if (count.value < 3) count.value++; });',
            'onUpdated(() => { if (count.value > 3) { return; } count.value++; });',
            'onUpdated(() => { other.value++; });',
            'onUpdated(() => { setTimeout(() => { count.value++; }); });',
            'onMounted(() => { count.value++; });',
            'onUpdated(() => { state.total = read(); });',
            'onUpdated((value) => { value.total++; });',
            'register({ updated() { count.value++; } });',
            'let renders = 0;\nonUpdated(() => { renders++; });',
        ].map(
            (body) =>
                `import { ref, reactive, onUpdated, onMounted } from "vue";\nconst count = ref(0);\nconst state = reactive({ total: 0 });\nlet other = { value: 0 };\n${body}`,
        ),
        'const count = ref(0);\nonUpdated(() => { count.value++; });',
    ],
    invalid: [
        ...[
            'onUpdated(() => { count.value += 1; });',
            'onUpdated(() => { count.value = count.value + 1; });',
            'onUpdated(() => { count.value = Date.now(); });',
            'onUpdated(function () { --state.total; });',
            'function bump() { count.value++; }\nonUpdated(bump);',
            'const bump = () => { count.value++; };\nonUpdated(bump);',
            'export default { updated() { count.value++; } };',
            'onUpdated(() => { if (ready) { save(); } count.value++; });',
        ].map((body) => ({
            code: `import { ref, reactive, onUpdated } from "vue";\nconst count = ref(0);\nconst state = reactive({ total: 0 });\n${body}`,
            errors: [{ messageId: 'loop' as const }],
        })),
        {
            code: 'import { ref, onUpdated, defineComponent } from "vue";\nconst count = ref(0);\nexport const Cart = defineComponent({ updated() { count.value++; } });',
            errors: [{ messageId: 'loop' }],
        },
    ],
});
