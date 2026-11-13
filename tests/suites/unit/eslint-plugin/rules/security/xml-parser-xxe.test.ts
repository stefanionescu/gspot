import { xmlParserXxe } from '#eslint-plugin/rules/security/xml-parser-xxe.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('xml-parser-xxe', xmlParserXxe, {
    valid: [
        "import libxmljs from 'libxmljs';\nlibxmljs.parseXmlString(xml);\nlibxmljs.parseXmlString(xml, { noblanks: true });",
    ],
    invalid: [
        {
            code: "const libxmljs = require('libxmljs');\nlibxmljs.parseXmlString(xml, { noent: true });\nlibxmljs.parseXml(xml, { noent: false });",
            errors: [{ messageId: 'entities', line: 2 }],
        },
    ],
});
