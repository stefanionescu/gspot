import { noSetterInComponent } from '#eslint-plugin/rules/react/no-setter-in-component.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-setter-in-component', noSetterInComponent, {
    valid: [
        'import { useState } from "react";\nfunction Cart() { const [count, setCount] = useState(0); return <button onClick={() => setCount(1)} />; }',
        'import { useState } from "react";\nfunction Cart() { const [count, setCount] = useState(0); if (count > 1) setCount(1); }',
        'import { useState } from "react";\nfunction useCart() { const [count, setCount] = useState(0); setCount(1); }',
        'import { useState } from "./state";\nfunction Cart() { const [count, setCount] = useState(0); setCount(1); }',
        'import { useState } from "react";\nfunction Cart() { const [count, setCount] = useState(); setCount(1); }',
    ],
    invalid: [
        {
            code: 'import { forwardRef, useState } from "react";\nconst Cart = forwardRef(function Cart(props, ref) { const [count, setCount] = useState(0); setCount(1); return null; });',
            errors: [{ messageId: 'setter', line: 2 }],
        },
        {
            code: 'import { useState } from "react";\nfunction Cart() { const [count, setCount] = useState(0); setCount(1); return null; }',
            errors: [{ messageId: 'setter', line: 2, column: 58 }],
        },
        {
            code: 'import React from "react";\nconst Cart = () => { const [items, setItems] = React.useState([]); setItems([]); };',
            errors: [{ messageId: 'setter', line: 2 }],
        },
        {
            code: "import { memo, useState } from 'react'; const Page = memo(() => { const [a, setA] = useState(0); setA(1); return null; });",
            errors: [{ messageId: 'setter' }],
        },
    ],
});
