import { importAstroPlugin, stripRuntimeGlobals, mergePresetRules, mergeRuleOptions, setRootFolder, setScriptParser } from "../javascript/eslint/functions.mjs";
import globals from "globals";
import typescriptEslint from "typescript-eslint";
export default [
    {"extends": [stripRuntimeGlobals(importAstroPlugin()["configs"]["flat/recommended"], globals)],
    "files": [["**/*.astro", "docs/**/*"], ["**/*.astro/*.ts", "docs/**/*"], ["**/*.astro/*.js", "docs/**/*"]]},
    setRootFolder(mergeRuleOptions(mergePresetRules({"rules": {
        "astro/no-set-html-directive": "error",
        "astro/no-exports-from-components": "error",
        "astro/no-prerender-export-outside-pages": "error",
        "astro/no-unused-css-selector": "error",
        "astro/prefer-class-list-directive": "error",
        "astro/prefer-object-class-list": "error",
        "astro/prefer-split-class-list": "error"
    },
    "files": [["**/*.astro", "docs/**/*"]]}, importAstroPlugin()["configs"]["flat/jsx-a11y-recommended"]), {
        "astro/jsx-a11y/no-noninteractive-tabindex": {
            "roles": [
                "tabpanel",
                "region"
            ]
        }
    }), [
        [
            "languageOptions",
            "parserOptions",
            "tsconfigRootDir"
        ]
    ]),
    setScriptParser({"rules": {
        "@typescript-eslint/no-unsafe-return": "off"
    },
    "processor": "astro/client-side-ts",
    "languageOptions": {
        "parserOptions": {
            "project": true,
            "projectService": false,
            "extraFileExtensions": [
                ".astro"
            ]
        }
    },
    "files": [["**/*.astro", "docs/**/*"]]}, typescriptEslint["parser"]),
    {"extends": [stripRuntimeGlobals(typescriptEslint["configs"]["disableTypeChecked"], globals)],
    "files": [["**/*.astro/*.ts", "docs/**/*"], ["**/*.astro/*.js", "docs/**/*"]]},
];
