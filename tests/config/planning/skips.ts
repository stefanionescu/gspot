const NEXT_INTL_PACKAGE = '{"dependencies":{"next-intl":"4.8.3"}}';

export const NEXT_INTL_PROJECTS = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'own child project',
        scope: 'app',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'inherited root project',
        scope: 'app/deep',
        files: { 'package.json': NEXT_INTL_PACKAGE },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
    {
        name: 'unrelated sibling project',
        scope: 'app',
        files: { 'sibling/package.json': NEXT_INTL_PACKAGE },
        selected: false,
    },
    { name: 'absent project', scope: 'app', files: {}, selected: false },
    {
        name: 'own child replaces inherited dependencies',
        scope: 'app',
        files: {
            'package.json': NEXT_INTL_PACKAGE,
            'app/package.json': '{"dependencies":{"react-i18next":"16.5.3"}}',
        },
        selected: false,
    },
] as const;

export const VUE_TSC_SKIP = [
    {
        check: 'vue/vue-tsc',
        skip: { cause: 'condition', note: 'Needs the typescript configuration, which this scope does not select.' },
    },
] as const;
