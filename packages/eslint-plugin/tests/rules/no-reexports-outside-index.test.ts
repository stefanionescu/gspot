import { tester } from '#plugin-tests/harness/tester.ts';
import { noReexportsOutsideIndex } from '#plugin/rules/no-reexports-outside-index.ts';

tester().run('no-reexports-outside-index', noReexportsOutsideIndex, {
    valid: [
        { code: "export * from './a';\nexport { b } from './b';", filename: '/repo/src/index.ts' },
        { code: "import { a } from './a';\nexport const c = a;", filename: '/repo/src/c.ts' },
        { code: 'export const c = 1;\nexport { c as d };', filename: '/repo/src/c.ts' },
    ],
    invalid: [
        { code: "export * from './a';", filename: '/repo/src/c.ts', errors: [{ messageId: 'outsideIndex' }] },
        { code: "export { b } from './b';", filename: '/repo/src/c.ts', errors: [{ messageId: 'outsideIndex' }] },
        { code: "export type { B } from './b';", filename: '/repo/src/c.ts', errors: [{ messageId: 'outsideIndex' }] },
    ],
});
