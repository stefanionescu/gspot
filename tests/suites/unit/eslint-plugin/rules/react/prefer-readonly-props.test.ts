import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { preferReadonlyProps } from '#eslint-plugin/rules/react/prefer-readonly-props.ts';

buildTypedRuleTester().run('prefer-readonly-props', preferReadonlyProps, {
    valid: [
        'function Badge(props: Readonly<{ label: string }>) { return <b>{props.label}</b>; }',
        'function Badge({ label }: { readonly label: string }) { return <b>{label}</b>; }',
        'function Badge(label: string) { return <b>{label}</b>; }',
        'function Badge(props: {}) { return <b />; }',
        'function Badge(props: { label: string } & { title: string }) { return <b />; }',
        'function Badge(props) { return <b>{props.label}</b>; }',
        'function Badge(props: { label: string }) { return props.label; }',
        'function badge(props: { label: string }) { return <b>{props.label}</b>; }',
        'function Badge(props: { label: string }) { function view() { return <b />; } return view; }',
    ],
    invalid: [
        {
            code: 'function Badge(props: { label: string }) { return <b>{props.label}</b>; }',
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
            errors: [
                {
                    messageId: 'mutable' as const,
                    suggestions: [{ messageId: 'mark' as const, output: `${head}Readonly<${type}>${tail}` }],
                },
            ],
        })),
        {
            code: 'function Card(props: Record<"title", string>) { return <div>{props.title}</div>; }',
            errors: [
                {
                    messageId: 'mutable',
                    suggestions: [
                        {
                            messageId: 'mark',
                            output: 'function Card(props: Readonly<Record<"title", string>>) { return <div>{props.title}</div>; }',
                        },
                    ],
                },
            ],
        },
    ],
});
