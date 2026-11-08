import { dompurifyUnsafeConfig } from '#eslint-plugin/rules/web/dompurify-unsafe-config.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('dompurify-unsafe-config', dompurifyUnsafeConfig, {
    valid: [
        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ALLOWED_TAGS: tags });",
        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { KEEP_CONTENT: true, RETURN_DOM: true });",

        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i'], ALLOWED_URI_REGEXP: /^https:/ });",
    ],
    invalid: [
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, SAFE_FOR_XML: false });\nDOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /https?:/ });\nDOMPurify.sanitize(html, { ADD_URI_SAFE_ATTR: ['href'] });",
            errors: [
                { messageId: 'unsafe', line: 2 },
                { messageId: 'unsafe', line: 3 },
                { messageId: 'unsafe', line: 4 },
            ],
        },
    ],
});
