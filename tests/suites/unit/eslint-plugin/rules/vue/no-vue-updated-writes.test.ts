import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-vue-updated-writes', plugin.rules['no-vue-updated-writes'], {
    valid: [
        ...[
            'onUpdated(() => { count.value = 1; });',
            'onUpdated(() => { count.value = count.value; });',
            'onUpdated(() => { if (count.value < 3) count.value++; });',
            'onUpdated(() => { if (count.value > 3) { return; } count.value++; });',
            'onUpdated(() => { if (count.value > 3) { throw new Error("full"); } count.value += 1; });',
            'onUpdated(() => { other.value++; });',
            'onUpdated(() => { setTimeout(() => { count.value++; }); });',
            'onMounted(() => { count.value++; });',
            'onUpdated(() => { state.total = read(); });',
            'onUpdated(refresh);',
            'onUpdated((value) => { value.total++; });',
            'onUpdated(() => { state.items.total++; });',
        ].map(
            (body) =>
                `import { ref, reactive, onUpdated, onMounted } from "vue";\nconst count = ref(0);\nconst state = reactive({ total: 0 });\nlet other = { value: 0 };\n${body}`,
        ),
        'const count = ref(0);\nonUpdated(() => { count.value++; });',
        'import { ref } from "vue";\nconst count = ref(0);\nexport const options = { updated() { count.value++; } };',
    ],
    invalid: [
        'onUpdated(() => { count.value++; });',
        'onUpdated(() => { count.value += 1; });',
        'onUpdated(() => { count.value = count.value + 1; });',
        'onUpdated(() => { count.value = Date.now(); });',
        'onUpdated(() => { state.total = Math.random(); });',
        'onUpdated(function () { --state.total; });',
        'function bump() { count.value++; }\nonUpdated(bump);',
        'const bump = () => { count.value++; };\nonUpdated(bump);',
        'export default { updated() { count.value++; } };',
        'onUpdated(() => { if (ready) { save(); } count.value++; });',
    ].map((body) => ({
        code: `import { ref, reactive, onUpdated, defineComponent } from "vue";\nconst count = ref(0);\nconst state = reactive({ total: 0 });\n${body}`,
        errors: [{ messageId: 'loop' as const }],
    })),
});
