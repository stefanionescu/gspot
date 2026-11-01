import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-noopener', plugin.rules['require-noopener'], {
    valid: ["window.open('https://example.com', '_blank', 'noopener,noreferrer');", "window.open('/help');"],
    invalid: [
        {
            code: "window.open('https://example.com', '_blank');\nwindow.open('https://example.com', '_blank', 'noopener');\nwindow.open('/local', '_blank');\nthis.window.open('https://a.com');\nconst url = 'https://x.com';\nwindow.open(url, '_blank', 'noreferrer');\nother.open('https://example.com');",
            errors: [
                { messageId: 'opener', line: 1 },
                { messageId: 'opener', line: 4 },
                { messageId: 'opener', line: 6 },
            ],
        },
    ],
});
