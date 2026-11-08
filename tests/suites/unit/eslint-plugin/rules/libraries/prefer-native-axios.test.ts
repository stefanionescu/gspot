import { preferNativeAxios } from '#eslint-plugin/rules/libraries/prefer-native-axios.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-native-axios', preferNativeAxios, {
    valid: [
        'import axios from "axios";\nawait Promise.all([axios.get(first), axios.get(second)]);',
        'import axios from "axios";\nawait axios.get(url, { signal: controller.signal });',
        'import axios from "./http";\naxios.all([first]);',
    ],
    invalid: [
        {
            code: 'import axios from "axios";\nawait axios.all([first, second]);',
            errors: [{ messageId: 'helper', data: { symbol: 'axios.all()', alternative: 'Promise.all()' } }],
        },
        {
            code: 'import axios from "axios";\nconst source = axios.CancelToken.source();\nawait axios.post(url, body, { cancelToken: source.token });',
            errors: [
                { messageId: 'cancelToken', line: 2 },
                { messageId: 'cancelToken', line: 3 },
            ],
        },
    ],
});
