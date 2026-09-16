# JavaScript Naming

JavaScript naming follows the same role, responsibility, and boundary principles
as TypeScript. Use the JavaScript rules when editing `.js`, `.mjs`, `.cjs`, and
plain JavaScript tooling files.

Project decisions:

- Prefer TypeScript for app code. Use JavaScript naming rules for tooling,
  config, migration support, quality scripts, and ecosystem-owned JavaScript.
- Use `kebab-case` source filenames in this repo, even though some external
  guides also allow underscores.
- Prefer named exports in hand-written modules.
- Use default exports only for ecosystem files that require them or external
  packages that expose them.
- Do not create static container classes or nested namespaces for organization.

## JavaScript Case Rules

Rules:

- Classes, constructor values, and React components use `PascalCase`.
- JSDoc record, interface, enum item, and typedef names use `PascalCase`.
- Functions, methods, variables, parameters, properties, and module aliases use
  `camelCase`.
- Constants may use `UPPER_SNAKE_CASE` when they are fixed global or module
  constants.
- JSDoc enum members use `UPPER_SNAKE_CASE`.
- Source filenames use `kebab-case` unless an ecosystem tool owns the filename.
- Do not use default exports unless an ecosystem file requires them.
- Do not use namespaces or static classes as containers.
- Use ASCII identifier names. Keep non-ASCII characters in strings or comments
  unless an external API requires otherwise.
- Do not abbreviate by deleting letters from a word.
- Do not use a trailing underscore to signal privacy; use module scope or the
  language/framework visibility mechanism available in that file.
- Short one-letter local names are acceptable only in tiny scopes where the role
  is conventional and obvious, such as `i` in a small loop.

Bad:

```js
class user_service {}
const MAXCOUNT = 10;
function Build_User() {}
const nErr = 3;
const cstmrId = user.id;
export default {
    parseThing() {},
};
```

Good:

```js
class UserRepository {}
const MAX_RETRY_COUNT = 10;

function buildUser() {}
const errorCount = 3;
const customerId = user.id;

export { UserRepository, buildUser };
```

## JavaScript Imports and Exports

Rules:

- Namespace import aliases use `camelCase` derived from the imported filename or
  clear package name.
- Named imports keep their exported name unless a collision forces an alias.
- If aliasing a named import is required, use a domain or path component that
  explains the collision.
- Default import names follow the identifier type being imported, but default
  imports should be limited to ecosystem modules that require them.
- Named exports keep naming consistent across import sites.
- Do not export mutable variables as the public contract. Export functions or an
  item with clearly named mutable fields when mutation is intentional.

Bad:

```js
import * as FileOne from '../file-one.js';
import { Cat as OtherThing } from './domesticated-animals.js';

export default class ProfileClient {}
export let activeUser = undefined;
```

Good:

```js
import * as fileOne from '../file-one.js';
import { Cat as DomesticatedCat } from './domesticated-animals.js';

export class ProfileClient {}

let activeUser = undefined;

export function getActiveUser() {
    return activeUser;
}
```

## JavaScript Files

Bad:

```text
Helpers.js
UserService.js
sharedUtils.mjs
data.cjs
```

Good:

```text
session-token-verifier.js
user-repository.js
email-template-formatter.mjs
database-connection.cjs
```

## JavaScript Functions and Values

Bad:

```js
function process(value) {
    return JSON.parse(value);
}

const d = new Date();
const arr = users.map((u) => u.id);
```

Good:

```js
function parseUserPayload(payloadText) {
    return JSON.parse(payloadText);
}

const currentDate = new Date();
const userIds = users.map((user) => user.id);
```

## JavaScript Boundaries

JavaScript often appears in tooling, config, and quality scripts. Name the
script owner and exported functions by the contract they serve.

Bad:

```js
export function run(value) {
    ...
}
```

Good:

```js
export function collectNamingViolations(scope, policy) {
    ...
}
```

