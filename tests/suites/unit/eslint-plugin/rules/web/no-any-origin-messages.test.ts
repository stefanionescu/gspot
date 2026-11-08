import { noAnyOriginMessages } from '#eslint-plugin/rules/web/no-any-origin-messages.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-any-origin-messages', noAnyOriginMessages, {
    valid: [
        "declare function handler(event: MessageEvent): void;\nwindow.addEventListener('message', handler);",

        "declare const worker: Worker;\nworker.postMessage({ ready: true }, '*' as never);",
        "window.parent.postMessage({ ready: true }, 'https://app.example.com');",
        "window.addEventListener('message', (event) => {\n    if (event.origin !== 'https://app.example.com') return;\n    console.log(event.data);\n});",
        "declare const worker: Worker;\nworker.addEventListener('message', (event) => { console.log(event.data); });",
        "function handle(event: any) {\n    const origin = event.origin || event.originalEvent.origin;\n    if (origin === 'https://app.example.com') console.log(event.data);\n}\nwindow.addEventListener('message', handle);",
        "window.onmessage = (event) => {\n    if (event.origin === 'https://app.example.com') console.log(event.data);\n};",
        "function handle(event: any) {\n    const source = event.originalEvent || event;\n    if (source.origin === 'https://app.example.com') console.log(source.data);\n}\nwindow.addEventListener('message', handle);",
        "function handle(event: any) {\n    const source = event || event.originalEvent;\n    if (source.origin === 'https://app.example.com') console.log(source.data);\n}\nwindow.addEventListener('message', handle);",
        "function handle(event: any) {\n    const origin = event.originalEvent.origin || event.origin;\n    if (origin === 'https://app.example.com') console.log(event.data);\n}\nwindow.addEventListener('message', handle);",
        "function handle(event: any) {\n    if (event.originalEvent.origin === 'https://app.example.com') console.log(event.data);\n}\nwindow.addEventListener('message', handle);",
        "declare const handle: (event: MessageEvent) => void;\nwindow.addEventListener('message', (event) => handle(event));",
        'declare const port: MessagePort;\nport.onmessage = (event) => { console.log(event.data); };',
        "window.addEventListener('message', (event) => { const { origin, data } = event; if (origin !== 'https://app.example.com') return; console.log(data); });",
        "window.addEventListener('message', (event) => { const origin = event.origin; if (origin !== 'https://app.example.com') return; console.log(event.data); });",
    ],
    invalid: [
        {
            code: "window.addEventListener('message', (event) => console.log(event.data));",
            errors: [{ messageId: 'unverifiedOrigin' }],
        },
        {
            code: "declare const frame: HTMLIFrameElement;\nframe.contentWindow?.postMessage({ ready: true }, '*');",
            errors: [{ messageId: 'anyTarget', line: 2 }],
        },
        {
            code: "const target = window.opener as Window;\ntarget.postMessage({ ready: true }, '*');",
            errors: [{ messageId: 'anyTarget', line: 2 }],
        },
        {
            code: "declare const untyped: any;\nuntyped.childWindow.postMessage({ ready: true }, '*');",
            errors: [{ messageId: 'anyTarget', line: 2 }],
        },
        {
            code: "window.addEventListener('message', (event) => {\n    console.log(event);\n});",
            errors: [{ messageId: 'unverifiedOrigin', line: 1 }],
        },
        {
            code: "function handle(event: any) {\n    console.log(event.origin || event.originalEvent.origin);\n}\nwindow.addEventListener('message', handle);",
            errors: [{ messageId: 'unverifiedOrigin', line: 4 }],
        },
        {
            code: 'window.onmessage = function (event) {\n    console.log(event.data);\n};',
            errors: [{ messageId: 'unverifiedOrigin', line: 1 }],
        },
    ],
});

buildRuleTester().run('no-any-origin-messages', noAnyOriginMessages, {
    valid: ["window.postMessage({ ready: true }, '*');"],
    invalid: [],
});
