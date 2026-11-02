import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('testing-library-queries', plugin.rules['testing-library-queries'], {
    valid: [
        'import { screen } from "@testing-library/react";\nexpect(screen.getByText("Saved")).toBeInTheDocument();',
        'import { screen } from "@testing-library/react";\nexpect(screen.queryByText("Saved")).not.toBeInTheDocument();',
        'import { screen } from "./screen";\nexpect(screen.getByText("Saved")).toBeNull();',
        'import { screen, waitFor } from "@testing-library/react";\nawait waitFor(() => { expect(screen.getByText("Saved")).toBeNull(); });',
        'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(() => screen.queryByText("Saving"));',
        'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(screen.getByText("Saving"));',
        'import { screen } from "@testing-library/react";\nexpect(element).toBeTruthy();',
        'import { screen } from "@testing-library/react";\nexpect(load()[0]).toBeTruthy();',
        'import { screen } from "@testing-library/react";\nwrapper(element).toBeTruthy();',
    ],
    invalid: [
        {
            code: 'import { screen } from "@testing-library/react";\nexpect(screen.getByText("Saved")).not.toBeInTheDocument();',
            output: 'import { screen } from "@testing-library/react";\nexpect(screen.queryByText("Saved")).not.toBeInTheDocument();',
            errors: [{ messageId: 'absence', line: 2 }],
        },
        {
            code: 'import { screen } from "@testing-library/vue";\nexpect(screen.queryAllByRole("row")[0]).toBeTruthy();',
            output: 'import { screen } from "@testing-library/vue";\nexpect(screen.getAllByRole("row")[0]).toBeTruthy();',
            errors: [{ messageId: 'presence', line: 2 }],
        },
        {
            code: 'import { screen } from "@testing-library/react";\nexpect(screen.queryAllByRole("row").length).toBeTruthy();',
            output: 'import { screen } from "@testing-library/react";\nexpect(screen.getAllByRole("row").length).toBeTruthy();',
            errors: [{ messageId: 'presence', line: 2 }],
        },
        {
            code: 'import { screen } from "@testing-library/react/pure";\nexpect(screen.getByText("Saved")).not.toBeInTheDocument();',
            output: 'import { screen } from "@testing-library/react/pure";\nexpect(screen.queryByText("Saved")).not.toBeInTheDocument();',
            errors: [{ messageId: 'absence', line: 2 }],
        },
        {
            code: 'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(() => screen.getByText("Saving"));',
            output: 'import { screen, waitForElementToBeRemoved } from "@testing-library/react";\nawait waitForElementToBeRemoved(() => screen.queryByText("Saving"));',
            errors: [{ messageId: 'throwingQuery', line: 2 }],
        },
        {
            code: 'import * as library from "@testing-library/react";\nawait library.waitForElementToBeRemoved(library.screen.findByText("Saving"));',
            errors: [{ messageId: 'asyncQuery', line: 2 }],
        },
    ],
});
