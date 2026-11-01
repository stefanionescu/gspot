import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-ignored-catch', plugin.rules['no-ignored-catch'], {
    valid: [
        'try { run(); } catch (error) {}',
        'try { run(); } catch (error) { fallback(); }',
        'try { if (ready) run(); } catch (error) {}',
        'try { retry: run(); } catch (error) {}',
        'try { run(); finish(); } catch (error) { report(error); }',
        'try { run(); finish(); } catch (error) { throw error; }',
        'try { run(); finish(); } catch (error) { error = undefined; }',
        'try { run(); finish(); } catch (error) { /* The failed optional step can be skipped. */ }',
        'try { run(); finish(); } catch (error) { // The optional result is unused.\n }',
        'try { run(); finish(); } catch {}',
        'try { run(); finish(); } catch ({ message }) {}',
        'try { run(); finish(); } catch (error) { const report = () => error; }',
    ],
    invalid: [
        ...[
            'try {} catch (error) {}',
            'try { run(); finish(); } catch (error) {}',
            'try { run(); finish(); } catch (error) { /* */ }',
            'try { run(); finish(); } catch (error) { // \n }',
            'try { run(); finish(); } catch (error) { /* Explanation */ fallback(); }',
            'try { run(); finish(); } catch (error) { function log(error) { report(error); } }',
            'try { retry: { run(); } } catch (error) {}',
        ].map((code) => ({ code, errors: [{ messageId: 'exception' as const }] })),
        ...[
            '{ run(); }',
            'for (;;) run();',
            'for (const key in options) run();',
            'for (const value of values) run();',
            'while (ready) run();',
            'do run(); while (ready);',
            'switch (value) { case 1: run(); }',
        ].map((body) => ({ code: `try { ${body} } catch (error) {}`, errors: [{ messageId: 'exception' as const }] })),
    ],
});
