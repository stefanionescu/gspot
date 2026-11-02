import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unsafe-sanitizer-bypass', plugin.rules['no-unsafe-sanitizer-bypass'], {
    valid: [
        'sanitizer.bypassSecurityTrustHtml("<strong>Trusted</strong>");',
        'sanitizer.bypassSecurityTrustStyle(`color: blue`);',
        'const text = "Trusted"; const value = text; sanitizer.bypassSecurityTrustHtml(value);',
        'const options = { text: "Trusted" }; sanitizer.bypassSecurityTrustHtml(options.text);',
        'const options = { text: "Trusted" }; const settings = { ...options }; sanitizer.bypassSecurityTrustHtml(settings.text);',
        'sanitizer.sanitize(dynamic);',
        'sanitizer.bypassSecurityTrustHtml();',
        'sanitizer["bypassSecurityTrustHtml"](dynamic);',
    ],
    invalid: [
        ...['Html'].map((kind) => ({
            code: `sanitizer.bypassSecurityTrust${kind}(dynamic);`,
            errors: [{ messageId: 'bypass' as const }],
        })),
        ...[
            'sanitizer.bypassSecurityTrustHtml(`Trusted ${dynamic}`);',
            'sanitizer.bypassSecurityTrustHtml(read());',
            'sanitizer.bypassSecurityTrustHtml("Trusted" + dynamic);',
            'let text = "Trusted"; text = dynamic; sanitizer.bypassSecurityTrustHtml(text);',
            'const options = { text: dynamic }; sanitizer.bypassSecurityTrustHtml(options.text);',
            'const options = { text: "Trusted" }; sanitizer.bypassSecurityTrustHtml(options["text"]);',
            'const options = { text: "Trusted" } as const; sanitizer.bypassSecurityTrustHtml(options.text);',
            'const options = { text: options.text }; sanitizer.bypassSecurityTrustHtml(options.text);',
            'const options = { ...options }; sanitizer.bypassSecurityTrustHtml(options.text);',
        ].map((code) => ({ code, errors: [{ messageId: 'bypass' as const }] })),
    ],
});
