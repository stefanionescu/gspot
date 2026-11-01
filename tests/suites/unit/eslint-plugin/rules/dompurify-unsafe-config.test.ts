import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('dompurify-unsafe-config', plugin.rules['dompurify-unsafe-config'], {
    valid: [
        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i'], ALLOWED_URI_REGEXP: /^https:/ });",
    ],
    invalid: [
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ADD_TAGS: ['iframe'], ADD_ATTR: ['onload'] });\nDOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i'] });\nDOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, SAFE_FOR_XML: false });\nDOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /https?:/ });\nDOMPurify.sanitize(html, { ADD_URI_SAFE_ATTR: ['href'] });\nconst config = { ADD_TAGS: ['script'] };\nDOMPurify.sanitize(html, config);",
            errors: [
                { messageId: 'unsafe', line: 2 },
                { messageId: 'unsafe', line: 4 },
                { messageId: 'unsafe', line: 5 },
                { messageId: 'unsafe', line: 6 },
            ],
        },
    ],
});
