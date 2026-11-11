import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { noRedundantOptional } from '#eslint-plugin/rules/types/no-redundant-optional.ts';
import { buildRuleTester, buildTypedRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-redundant-optional', noRedundantOptional, {
    valid: ['type User = { name?: string };', 'type User = { name: string | undefined };'],
    invalid: [
        { code: 'type User = { name?: string | undefined };', errors: [{ messageId: 'optional' }] },
        { code: 'class User { name?: string | undefined }', errors: [{ messageId: 'optional' }] },
    ],
});

buildTypedRuleTester().run('no-redundant-optional with types', noRedundantOptional, {
    valid: ['type Name = string; type User = { name?: Name };'],
    invalid: [
        {
            code: 'type Maybe = string | undefined; type User = { name?: Maybe };',
            errors: [{ messageId: 'optional' }],
        },
    ],
});

const root = writePackageFolders({ exact: {} });
writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, exactOptionalPropertyTypes: true }, include: ['exact/*.ts'] }),
);
writeFileSync(join(root, 'exact/user.ts'), '');

buildRuleTester({
    root,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
}).run('no-redundant-optional with exactOptionalPropertyTypes', noRedundantOptional, {
    valid: [{ code: 'type User = { name?: string | undefined };', filename: join(root, 'exact/user.ts') }],
    invalid: [],
});
