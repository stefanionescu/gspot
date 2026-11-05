import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { noLeakedJsxNumber } from '#eslint-plugin/rules/react/no-leaked-jsx-number.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ app: {} });
writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, jsx: 'preserve' }, include: ['app/*.tsx'] }),
);
writeFileSync(join(root, 'app/view.tsx'), '');
const filename = join(root, 'app/view.tsx');
const tester = buildRuleTester({
    root,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
});

tester.run('no-leaked-jsx-number', noLeakedJsxNumber, {
    valid: [{ code: 'declare const count: number;\nexport const view = <div>{count > 0 && <b />}</div>;', filename }],
    invalid: [
        {
            code: 'declare const count: number;\nexport const view = <div>{count && <b />}</div>;',
            filename,
            errors: [
                {
                    messageId: 'leaked',
                    line: 2,
                    suggestions: [
                        {
                            messageId: 'convert',
                            output: 'declare const count: number;\nexport const view = <div>{!!(count) && <b />}</div>;',
                        },
                    ],
                },
            ],
        },
        {
            code: 'declare const ready: boolean;\ndeclare const total: bigint;\nexport const view = <div>{ready && total && <b />}</div>;',
            filename,
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
            filename,
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
