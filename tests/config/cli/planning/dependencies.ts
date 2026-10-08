export const DEPENDENCY_CASES = [
    {
        name: 'root project',
        scope: '',
        files: { 'package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: true,
    },
    {
        name: 'own child project',
        scope: 'app',
        files: { 'app/package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: true,
    },
    {
        name: 'inherited root project',
        scope: 'app/deep',
        files: { 'package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: true,
    },
    {
        name: 'unrelated child project',
        scope: '',
        files: { 'app/package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: false,
    },
    {
        name: 'unrelated sibling project',
        scope: 'app',
        files: { 'sibling/package.json': '{"dependencies":{"next-intl":"4.8.3"}}' },
        selected: false,
    },
    { name: 'absent project', scope: 'app', files: {}, selected: false },
    {
        name: 'own child replaces inherited dependencies',
        scope: 'app',
        files: {
            'package.json': '{"dependencies":{"next-intl":"4.8.3"}}',
            'app/package.json': '{"dependencies":{"react-i18next":"16.5.3"}}',
        },
        selected: false,
    },
];
