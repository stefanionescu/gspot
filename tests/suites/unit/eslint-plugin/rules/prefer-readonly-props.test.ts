import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const rule = plugin.rules['prefer-readonly-props'];

buildTypedRuleTester().run('prefer-readonly-props', rule, {
    valid: [
        'function Badge(props: Readonly<{ label: string }>) { return <b>{props.label}</b>; }',
        'function Badge({ label }: { readonly label: string }) { return <b>{label}</b>; }',
        'type Props = Readonly<{ label: string }>;\nfunction Badge(props: Props) { return <b>{props.label}</b>; }',
        'interface Props { readonly label: string }\nfunction Badge(props: Props) { return <b>{props.label}</b>; }',
        'interface Base { readonly id: number }\ninterface Props extends Base { readonly label: string }\nfunction Badge(props: Props) { return <b>{props.id}</b>; }',
        'type Props = { readonly [key in "label" | "title"]: string };\nfunction Badge(props: Props) { return <b>{props.label}</b>; }',
        'function Badge(label: string) { return <b>{label}</b>; }',
        'function Badge(props: {}) { return <b />; }',
        'function Badge(props: { label: string } & { title: string }) { return <b />; }',
        'function Badge(props) { return <b>{props.label}</b>; }',
        'function Badge(props: { label: string }) { return props.label; }',
        'function badge(props: { label: string }) { return <b>{props.label}</b>; }',
        'function Badge(props: { label: string }, context: unknown) { return <b />; }',
        'const Badge = (props: { label: string }) => <b>{props.label}</b>;',
        'function Badge(props: { label: string }) { function view() { return <b />; } return view; }',
    ].map((code) => ({ code, filename: 'react.tsx' })),
    invalid: [
        {
            code: 'function Badge(props: { label: string }) { return <b>{props.label}</b>; }',
            filename: 'react.tsx',
            errors: [
                {
                    messageId: 'mutable',
                    line: 1,
                    column: 16,
                    suggestions: [
                        {
                            messageId: 'mark',
                            output: 'function Badge(props: Readonly<{ label: string }>) { return <b>{props.label}</b>; }',
                        },
                    ],
                },
            ],
        },
        ...[
            [
                'interface Props { label: string }\nfunction Badge({ label }: ',
                'Props',
                ') { const view = <b>{label}</b>; return view; }',
            ],
            [
                'interface Base { id: number }\ninterface Props extends Base { readonly label: string }\nfunction Badge(props: ',
                'Props',
                ') { return <b>{props.id}</b>; }',
            ],
            ['function Badge(props: ', '{ readonly label: string; title: string }', ') { return <></>; }'],
        ].map(([head = '', type = '', tail = '']) => ({
            code: `${head}${type}${tail}`,
            filename: 'react.tsx',
            errors: [
                {
                    messageId: 'mutable' as const,
                    suggestions: [{ messageId: 'mark' as const, output: `${head}Readonly<${type}>${tail}` }],
                },
            ],
        })),
    ],
});

buildRuleTester().run('prefer-readonly-props without types', rule, {
    valid: ['function Badge(props: { label: string }) { return <b>{props.label}</b>; }'],
    invalid: [],
});
