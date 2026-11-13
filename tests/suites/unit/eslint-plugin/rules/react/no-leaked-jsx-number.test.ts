import { noLeakedJsxNumber } from '#eslint-plugin/rules/react/no-leaked-jsx-number.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-leaked-jsx-number', noLeakedJsxNumber, {
    valid: ['declare const name: string;\nexport const view = <div>{name && <b />}</div>;'],
    invalid: [
        {
            code: 'declare const ready: boolean;\ndeclare const total: bigint;\nexport const view = <div>{ready && total && <b />}</div>;',
            errors: [
                {
                    messageId: 'leaked',
                    line: 3,
                    suggestions: [
                        {
                            messageId: 'convert',
                            output: 'declare const ready: boolean;\ndeclare const total: bigint;\nexport const view = <div>{ready && !!(total) && <b />}</div>;',
                        },
                    ],
                },
            ],
        },
        {
            code: 'import { Text } from "react-native";\ndeclare const name: string;\nexport const view = <Text>{name && <Text />}</Text>;',
            errors: [
                {
                    messageId: 'leaked',
                    line: 3,
                    suggestions: [
                        {
                            messageId: 'convert',
                            output: 'import { Text } from "react-native";\ndeclare const name: string;\nexport const view = <Text>{!!(name) && <Text />}</Text>;',
                        },
                    ],
                },
            ],
        },
    ],
});
