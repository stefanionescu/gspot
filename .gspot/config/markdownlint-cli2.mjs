import { fileURLToPath } from 'node:url';

export default {
    config: { extends: fileURLToPath(new URL('markdownlint.jsonc', import.meta.url)) },
    noBanner: true,
    noProgress: true,
    outputFormatters: [
        [
            /**
             * Write the findings as JSON.
             * @param {object} output the formatter input.
             * @param {unknown} output.results the findings.
             * @param {(message: string) => void} output.logMessage the report writer.
             * @returns {void} nothing.
             */
            ({ results, logMessage }) => logMessage(JSON.stringify(results)),
        ],
    ],
};
