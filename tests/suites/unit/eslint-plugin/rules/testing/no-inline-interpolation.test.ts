import { join } from 'node:path';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';
import { noInlineInterpolation } from '#eslint-plugin/rules/testing/no-inline-interpolation.ts';

const root = writePackageFolders({ jest: { devDependencies: { jest: '30.0.0' } }, plain: {} });
const filename = join(root, 'jest/a.test.ts');

buildRuleTester({ root }).run('no-inline-interpolation', noInlineInterpolation, {
    valid: [
        { code: 'expect(user).toMatchInlineSnapshot(`{ "id": ${id} }`);', filename: join(root, 'plain/a.test.ts') },
        { code: 'expect(user).toMatchInlineSnapshot(`{ "id": 1 }`);', filename },
        { code: 'expect(user).toMatchSnapshot(`${id}`);', filename },
        { code: 'expect(user).toEqual.toMatchInlineSnapshot(`${id}`);', filename },
        { code: 'const expect = check;\nexpect(user).toMatchInlineSnapshot(`${id}`);', filename },
        { code: 'expect.soft(user).toMatchInlineSnapshot(`${id}`);', filename },
    ],
    invalid: [
        {
            code: 'expect(user).toMatchInlineSnapshot(`{ "id": ${id} }`);',
            filename,
            errors: [{ messageId: 'interpolation', column: 36 }],
        },
        {
            code: 'expect(run).not.toThrowErrorMatchingInlineSnapshot(`${message}`);',
            filename,
            errors: [{ messageId: 'interpolation' }],
        },
        {
            code: 'import { expect } from "vitest";\nawait expect(load()).resolves.toMatchInlineSnapshot({ id: expect.any(Number) }, `${id}`);',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'interpolation', line: 2 }],
        },
    ],
});
