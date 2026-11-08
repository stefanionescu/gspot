import { noTryPromise } from '#eslint-plugin/rules/promises/no-try-promise.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-try-promise', noTryPromise, {
    valid: ['try { list.sort(); } catch {}'],
    invalid: [],
});

buildTypedRuleTester().run('no-try-promise', noTryPromise, {
    valid: [
        'declare function save(): Promise<void>; async function run() { try { await save(); } catch (error) { report(error); } }',
        'declare function save(): Promise<void>; declare function log(): void; try { save(); log(); } catch (error) { report(error); }',
        'declare function save(): Promise<void>; try { save(); } finally { close(); }',
    ],
    invalid: [
        {
            code: 'declare function save(): Promise<void>; try { save(); } catch (error) { report(error); }',
            errors: [{ messageId: 'open' }],
        },
        {
            code: 'declare function save(): Promise<void>; try { save().catch(() => {}); } catch (error) { report(error); }',
            errors: [{ messageId: 'caught' }],
        },
        {
            code: 'declare function save(): Promise<void>; try { save().then(close); } catch (error) {}',
            errors: [{ messageId: 'open' }],
        },
        {
            code: 'async function run(load: () => Promise<number>) { try { new Promise(load); } catch {} }',
            errors: [{ messageId: 'open' }],
        },
    ],
});
