export const TSC_REPLACEMENTS = [
    { configuration: 'vue', check: 'vue/vue-tsc', source: 'src/App.vue', text: '<template><p>App</p></template>' },
] as const;

export const SCOPE_WIDE_IGNORE_CASES = [
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
] as const;
