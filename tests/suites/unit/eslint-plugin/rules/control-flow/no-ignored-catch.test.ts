import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noIgnoredCatch } from '#eslint-plugin/rules/control-flow/no-ignored-catch.ts';

buildRuleTester().run('no-ignored-catch', noIgnoredCatch, {
    valid: [
        'try { run(); } catch (error) {}',
        'try { retry: run(); } catch (error) {}',
        'try { run(); finish(); } catch (error) { report(error); }',
        'try { run(); finish(); } catch (error) { /* The failed optional step can be skipped. */ }',
        'try { run(); finish(); } catch {}',
        'try { run(); finish(); } catch ({ message }) {}',
    ],
    invalid: [
        ...[
            'try {} catch (error) {}',
            'try { run(); finish(); } catch (error) {}',
            'try { run(); finish(); } catch (error) { /* */ }',
            'try { run(); finish(); } catch (error) { /* Explanation */ fallback(); }',
            'try { retry: { run(); } } catch (error) {}',
        ].map((code) => ({ code, errors: [{ messageId: 'exception' as const }] })),
        ...['{ run(); }'].map((body) => ({
            code: `try { ${body} } catch (error) {}`,
            errors: [{ messageId: 'exception' as const }],
        })),
    ],
});
