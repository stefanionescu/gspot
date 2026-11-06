import { mergePresetRules, addPlugins } from "../javascript/eslint/functions.mjs";
import eslintPluginZod from "eslint-plugin-zod";
export default [
    addPlugins(mergePresetRules({"rules": {
        "zod/consistent-import": [
            "error",
            {
                "syntax": "named"
            }
        ],
        "zod/prefer-strict-object": "error",
        "zod/prefer-meta-last": "error"
    },
    "files": [["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "packages/cli/**/*"], ["**/*.astro", "packages/cli/**/*"], ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "tests/**/*"], ["**/*.astro", "tests/**/*"]]}, eslintPluginZod["configs"]["recommended"]), { "zod": eslintPluginZod }),
];
