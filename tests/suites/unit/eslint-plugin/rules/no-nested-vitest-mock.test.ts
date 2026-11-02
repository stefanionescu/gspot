import { join } from 'node:path';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ vitest: { devDependencies: { vitest: '4.0.0' } }, plain: {} });
const filename = join(root, 'vitest/a.test.ts');

buildRuleTester({ root }).run('no-nested-vitest-mock', plugin.rules['no-nested-vitest-mock'], {
    valid: [
        { code: 'vi.mock("./store");', filename },
        { code: 'it("reads", () => { vi.doMock("./store"); });', filename },
        { code: 'it("reads", () => { vi.mock("./store"); });', filename: join(root, 'plain/a.test.ts') },
        { code: 'const vi = other;\nit("reads", () => { vi.mock("./store"); });', filename },
        { code: 'import { vi } from "vitest";\nvi.mock("./store", () => ({ read: vi.fn() }));', filename },
    ],
    invalid: [
        {
            code: 'it("reads", () => { vi.mock("./store"); });',
            filename,
            errors: [{ messageId: 'scope', column: 21 }],
        },
        {
            code: 'import { vi } from "vitest";\nif (enabled) { vi.mock("./store"); }',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'scope', line: 2 }],
        },
        {
            code: 'import { vitest } from "vitest";\nexport const mocked = vitest.mock("./store");',
            filename: join(root, 'plain/b.test.ts'),
            errors: [{ messageId: 'scope' }],
        },
    ],
});
