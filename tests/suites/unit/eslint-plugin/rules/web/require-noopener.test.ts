import { requireNoopener } from '#eslint-plugin/rules/web/require-noopener.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-noopener', requireNoopener, {
    valid: [
        "window.open('https://example.com', '_blank', 'noopener,noreferrer');",
        "window.open('/help');",
        "other.open('https://example.com');",
    ],
    invalid: [
        "window.open('https://example.com', '_blank');",
        "this.window.open('https://a.com');",
        "const url = 'https://x.com';\nwindow.open(url, '_blank', 'noreferrer');",
    ].map((code) => ({ code, errors: [{ messageId: 'opener' as const }] })),
});
