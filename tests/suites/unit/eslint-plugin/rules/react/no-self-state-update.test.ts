import { noSelfStateUpdate } from '#eslint-plugin/rules/react/no-self-state-update.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-self-state-update', noSelfStateUpdate, {
    valid: [
        'import { useState } from "react";\nconst [count, setCount] = useState(0);\nconst [other, setOther] = useState(0);\nsetCount(other);',
        'import { useState } from "./state";\nconst [count, setCount] = useState(0);\nsetCount(count);',
        'import { useState } from "react";\nconst [run, setRun] = useState(() => noop);\nrun(run);',
    ],
    invalid: [
        {
            code: 'import { useState } from "react";\nconst [count, setCount] = useState(0);\nsetCount(count);',
            errors: [{ messageId: 'useless', line: 3 }],
        },
    ],
});
