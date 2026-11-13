import { createRequire } from 'node:module';

import plugin from '@gspothq/eslint-plugin';
import { ESLint, type Linter } from 'eslint';

const commonjs = createRequire(import.meta.url)('@gspothq/eslint-plugin') as { default: typeof plugin };
const findings: unknown[] = [];
for (const published of [plugin, commonjs.default])
    for (const config of [published.configs.recommended, published.configs.all]) {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [config as Linter.Config] });
        const results = await eslint.lintText("'use client';\nconsole.log(process.env.SECRET);\n", {
            filePath: 'client.js',
        });
        findings.push(
            results
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === 'gspot/no-client-environment')
                .map(({ line, messageId }) => ({ line, messageId })),
        );
    }
process.stdout.write(JSON.stringify(findings));
