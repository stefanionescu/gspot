import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noMisleadingArrayReverse } from '#eslint-plugin/rules/collections/no-misleading-array-reverse.ts';

buildRuleTester().run('no-misleading-array-reverse', noMisleadingArrayReverse, {
    valid: ['try { list.sort(); } catch {}'],
    invalid: [],
});

buildTypedRuleTester().run('no-misleading-array-reverse', noMisleadingArrayReverse, {
    valid: [
        'declare const tree: { sort(): void }; tree.sort();',
        'declare const list: number[]; declare const name: "pop"; list[name]();',
        'declare const posts: string[]; posts.reverse();',
        'declare const posts: string[]; function newest() { return posts.sort(); }',
        'declare let posts: string[]; posts = posts.reverse();',
        'const newest = [1, 2].reverse();',
        'class Feed { get posts() { return [1]; } count() { return this.posts.reverse().length; } }',
    ],
    invalid: [
        {
            code: 'declare const posts: string[]; const newest = posts.reverse();',
            errors: [{ messageId: 'mutation', data: { method: 'reverse', replacement: 'toReversed' } }],
        },
        {
            code: 'declare const posts: string[]; show(posts.sort());',
            errors: [{ messageId: 'mutation', data: { method: 'sort', replacement: 'toSorted' } }],
        },
        {
            code: 'declare const posts: string[]; function newest() { return { posts: posts.reverse() }; }',
            errors: [{ messageId: 'mutation' }],
        },
    ],
});
