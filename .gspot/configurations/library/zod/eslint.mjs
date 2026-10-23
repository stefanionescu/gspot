import { stripRuntimeGlobals } from "../../language/javascript/eslint/functions.mjs";
import globals from "globals";
import zodPlugin from "eslint-plugin-zod";
export default [
    // zod
    stripRuntimeGlobals({
        plugins: {
            zod: zodPlugin
        },
        "ignores": [],
        rules: {
            "zod/no-any-schema": "error",
            "zod/no-coerce-boolean": "error",
            "zod/no-empty-custom-schema": "error",
            "zod/no-native-enum": "error",
            "zod/no-promise-schema": "error",
            "zod/no-throw-in-refine": "error",
            "zod/prefer-strict-object": "error",
            "zod/prefer-meta-last": "error",
            "zod/require-brand-type-parameter": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "docs/**/*"
            ],
            [
                "**/*.astro",
                "docs/**/*"
            ]
        ]
    }, globals),
    // zod
    stripRuntimeGlobals({
        plugins: {
            zod: zodPlugin
        },
        "ignores": [],
        rules: {
            "zod/no-any-schema": "error",
            "zod/no-coerce-boolean": "error",
            "zod/no-empty-custom-schema": "error",
            "zod/no-native-enum": "error",
            "zod/no-promise-schema": "error",
            "zod/no-throw-in-refine": "error",
            "zod/prefer-strict-object": "error",
            "zod/prefer-meta-last": "error",
            "zod/require-brand-type-parameter": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "packages/cli/**/*"
            ],
            [
                "**/*.astro",
                "packages/cli/**/*"
            ]
        ]
    }, globals),
    // zod
    stripRuntimeGlobals({
        plugins: {
            zod: zodPlugin
        },
        "ignores": [],
        rules: {
            "zod/no-any-schema": "error",
            "zod/no-coerce-boolean": "error",
            "zod/no-empty-custom-schema": "error",
            "zod/no-native-enum": "error",
            "zod/no-promise-schema": "error",
            "zod/no-throw-in-refine": "error",
            "zod/prefer-strict-object": "error",
            "zod/prefer-meta-last": "error",
            "zod/require-brand-type-parameter": "error"
        },
        files: [
            [
                "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
                "tests/**/*"
            ],
            [
                "**/*.astro",
                "tests/**/*"
            ]
        ]
    }, globals),
];
