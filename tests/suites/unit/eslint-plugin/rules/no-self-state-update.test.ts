import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-self-state-update', plugin.rules['no-self-state-update'], {
    valid: [
        'import { useState } from "react";\nconst [count, setCount] = useState(0);\nsetCount(count + 1);',
        'import { useState } from "react";\nconst [count, setCount] = useState(0);\nconst [other, setOther] = useState(0);\nsetCount(other);',
        'import { useState } from "./state";\nconst [count, setCount] = useState(0);\nsetCount(count);',
    ],
    invalid: [
        {
            code: 'import { useState } from "react";\nconst [count, setCount] = useState(0);\nsetCount(count);',
            errors: [{ messageId: 'useless', line: 3 }],
        },
        {
            code: 'import * as React from "react";\nfunction Cart() { const [open, setOpen] = React.useState(false); return <a onClick={() => setOpen(open)} />; }',
            errors: [{ messageId: 'useless', line: 2 }],
        },
    ],
});
