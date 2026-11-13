import { dompurifyUnsafeConfig } from '#eslint-plugin/rules/web/dompurify-unsafe-config.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('dompurify-unsafe-config', dompurifyUnsafeConfig, {
    valid: [
        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ALLOWED_TAGS: tags });",
        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { KEEP_CONTENT: true, RETURN_DOM: true });",
        "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i'], ALLOWED_URI_REGEXP: /^https:/ });",
        "import { sanitize } from './html';\nsanitize(html, { ADD_TAGS: ['script'] });",
    ],
    invalid: [
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, SAFE_FOR_XML: false });",
            errors: [
                {
                    messageId: 'unsafe',
                    data: { actions: "set 'WHOLE_DOCUMENT' to 'false' and set 'SAFE_FOR_XML' to 'true'" },
                },
            ],
        },
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /https?:/ });",
            errors: [{ messageId: 'unsafe', data: { actions: "anchor the 'ALLOWED_URI_REGEXP' pattern with '^'" } }],
        },
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ADD_URI_SAFE_ATTR: ['href'] });",
            errors: [{ messageId: 'unsafe', data: { actions: "remove 'href' from 'ADD_URI_SAFE_ATTR'" } }],
        },
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ADD_TAGS: ['b', 'script'] });",
            errors: [{ messageId: 'unsafe', data: { actions: "remove 'script' from 'ADD_TAGS'" } }],
        },
        {
            code: "import DOMPurify from 'dompurify';\nDOMPurify.sanitize(html, { ADD_ATTR: ['title', 'onclick'] });",
            errors: [{ messageId: 'unsafe', data: { actions: "remove 'onclick' from 'ADD_ATTR'" } }],
        },
    ],
});
