import { noComponentDebounce } from '#eslint-plugin/rules/react/no-component-debounce.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-component-debounce', noComponentDebounce, {
    valid: [
        'import { debounce } from "lodash";\nconst onChange = debounce(search, 300);',
        'import { debounce } from "lodash";\nfunction search() { return debounce(load, 300); }',
        'import { debounce } from "./timers";\nfunction Search() { const onChange = debounce(search, 300); }',
        'import { debounce } from "lodash";\nimport { useMemo } from "react";\nfunction Search() { const onChange = useMemo(() => debounce(search, 300), []); }',
        'import { debounce } from "lodash";\nimport { useCallback } from "react";\nfunction Search() { const onChange = useCallback(debounce(search, 300), []); }',
        'import { throttle } from "lodash";\nimport { useRef } from "react";\nfunction Search() { const onScroll = useRef(throttle(load, 100)); }',
        'import { debounce } from "lodash";\nimport { useRef } from "react";\nfunction Search() {\n    const ref = useRef(null);\n    if (!ref.current) ref.current = debounce(search, 300);\n}',
        'import { debounce } from "lodash";\nimport { useRef } from "react";\nfunction Search() {\n    const ref = useRef(null);\n    if (ref.current === null) {\n        ref.current = debounce(search, 300);\n    }\n}',
        'import { debounce } from "lodash";\nimport { Component } from "react";\nclass Search extends Component { onChange = debounce(this.search, 300); render() { return null; } }',
        'import { debounce } from "lodash";\nclass Search extends Store { render() { return debounce(this.search, 300); } }',
    ],
    invalid: [
        {
            code: 'import { debounce } from "lodash";\nfunction Search() { const onChange = debounce(search, 300); }',
            errors: [
                { messageId: 'function', data: { kind: 'debounced', purpose: 'debouncing' }, line: 2, column: 38 },
            ],
        },
        {
            code: 'import _ from "lodash-es";\nconst useSearch = () => { const onScroll = _.throttle(load, 100); };',
            errors: [
                { messageId: 'function', data: { kind: 'throttled', purpose: 'throttling' }, line: 2, column: 46 },
            ],
        },
        {
            code: 'import debounce from "lodash/debounce";\nimport { useRef } from "react";\nfunction Search() {\n    const ref = useRef(null);\n    ref.current = debounce(search, 300);\n}',
            errors: [{ messageId: 'function' }],
        },
        {
            code: 'const _ = require("underscore");\nexport default function Search() { return _.debounce(search, 300); }',
            errors: [{ messageId: 'function' }],
        },
        {
            code: 'import { debounce } from "lodash";\nimport React from "react";\nclass Search extends React.Component { render() { const onChange = debounce(this.search, 300); return null; } }',
            errors: [{ messageId: 'class', data: { kind: 'debounced', purpose: 'debouncing' } }],
        },
        {
            code: 'import { debounce } from "lodash";\nfunction Card(ref) { if (ref.current === null) ref.current = debounce(save, 100); return ref; }',
            errors: [{ messageId: 'function' }],
        },
        {
            code: 'import { debounce } from "lodash";\nimport { Component } from "react";\nconst Card = class extends Component { render() { const run = debounce(save, 100); return run; } };',
            errors: [{ messageId: 'class' }],
        },
    ],
});
