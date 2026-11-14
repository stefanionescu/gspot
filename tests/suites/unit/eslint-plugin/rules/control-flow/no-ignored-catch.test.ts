import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noIgnoredCatch } from '#eslint-plugin/rules/control-flow/no-ignored-catch.ts';

buildRuleTester().run('no-ignored-catch', noIgnoredCatch, {
    valid: [
        'try { run(); } catch (error) {}',
        'try { run(); finish(); } catch (error) { report(error); }',
        'try { run(); finish(); } catch (error) { /* The failed optional step can be skipped. */ }',
    ],
    invalid: [
        'try {} catch (error) {}',
        'try { run(); finish(); } catch (error) {}',
        'try { run(); finish(); } catch (error) { /* */ }',
        'try { run(); finish(); } catch (error) { /* Explanation */ fallback(); }',
        'try { retry: { run(); } } catch (error) {}',
        'try { run(); finish(); } catch {}',
        'try { first(); second(); } catch { cleanup(); }',
    ].map((code) => ({ code, errors: [{ messageId: 'exception' as const }] })),
});
