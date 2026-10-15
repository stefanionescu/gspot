# Naming

## Casing across languages

<!-- level: all -->

Each language naming file states its own case table. These decisions hold across every language so
the same concept reads the same way throughout the program.

| Concern               | Rule                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acronyms              | Follow the language: TypeScript, JavaScript treat them as words such as `parseHttpUrl`, `userId`; Swift keeps uppercase initialisms (`avatarURL`, `userID`, `apiClient` at the start of a name); Python, SQL, Bash lowercase them inside snake_case such as `http_url`, `user_id`. A platform name keeps its spelling such as `XMLHttpRequest`. |
| Directories           | kebab-case for TypeScript, JavaScript, Bash, HTML, CSS, and static sites; snake_case for Python packages; PascalCase for Swift directories, which mirror type names.                                                                                                                                                                            |
| On the wire           | Preserve existing external interfaces. For interfaces defined by the project, use camelCase JSON fields, kebab-case URL segments.                                                                                                                                                                                                               |
| Environment variables | `UPPER_SNAKE_CASE`, named by the external interface. No application prefix is required; names defined by the platform are kept verbatim.                                                                                                                                                                                                        |
| Constants             | Module-level constants bound to a literal or a frozen object are `UPPER_SNAKE_CASE` in TypeScript, JavaScript, Python, and Bash, and lowerCamelCase in Swift.                                                                                                                                                                                   |

## Authority

<!-- level: all -->

The naming check enforces banned words, case, and length. Fix a finding by renaming. Never hide a
bad name in a string key, an alias, or a file name.

## Principles

<!-- level: all -->

A name lets a reader understand the concept, scope, role, and expected value without reading
the implementation. Name by role, responsibility, and domain meaning, never by storage type,
UI framework type, collection shape, or implementation accident. Use English unless an
external identifier keeps another spelling. Prefer the shortest name that gives a clear meaning at the use
site, and add a qualifier only when the bare name has more than one meaning there. Never invent private
shorthand or drop letters from a word.

Do not repeat context the enclosing type, module, directory, or package already supplies, and
do not encode every implementation detail. One concept keeps one word across a feature. Use singular names for single values, plural names for collections, and
named by their contents. A role word carries meaning where a primitive or weak type does not.

| Avoid               | Prefer                        | Why                                 |
| ------------------- | ----------------------------- | ----------------------------------- |
| `string`, `dict`    | `welcomeMessage`, `usersById` | The role, not the type.             |
| `u`, `tmp`, `cfg`   | `user`, `accountSummary`      | Whole words a stranger can read.    |
| `userArray`         | `users`                       | The type already says array.        |
| `Car.carMake`       | `Car.make`                    | The type supplies the context.      |
| `optionalAvatarURL` | `avatarURL`                   | Optionality lives in the type.      |
| `UserManager`       | `UserRepository`              | The real responsibility.            |
| `DataProcessor`     | `ProfileImageClient`          | An external API.                    |
| `CommonUtils`       | `DateRangeFormatter`          | A capability, not a dumping ground. |

## Role words

<!-- level: all -->

A suffix names the role of a type. Use each suffix for one meaning. Name a type with no such role for its concrete domain concept.

| Role word    | Use when                                                             |
| ------------ | -------------------------------------------------------------------- |
| `UseCase`    | Application operation or business workflow.                          |
| `Repository` | Domain-facing access to persisted, cached, or remote domain data.    |
| `Client`     | External API, SDK, HTTP, storage, or platform protocol.              |
| `Factory`    | Type that constructs instances and assembles dependencies.           |
| `Formatter`  | Converts a value into a display or wire representation.              |
| `Parser`     | Converts raw input into structured data.                             |
| `Validator`  | Checks a value and returns or throws validation failure.             |
| `Mapper`     | Converts between explicit layers, such as record to domain.          |
| `Store`      | Holds local mutable state or persistence mechanics.                  |
| `Provider`   | Supplies a capability or value, especially when the source may vary. |
| `Adapter`    | Bridges one interface or framework shape to another.                 |

Use `Route`, `Callback`, `Observer`, and `Listener` only for the corresponding framework shape. The language file for the framework defines UI role words such as `View`, `ViewModel`, `ViewController`, and `Coordinator`. Never use `Manager`. Use `Service` only
where the framework uses it, such as a NestJS provider. Preserve external names such as Apple's
`FileManager`.

## Functions and methods

<!-- level: all -->

A function name starts with the action and carries enough domain context to read at the call site without
repeating the enclosing type or module. A generic verb such as `process`, `handle`, `execute`, `manage`, `perform`,
or `ensure` never stands where the name can state the action. `handle` exists only in a framework callback such as
a React `handleSubmit` or a UIKit `@objc handleConfirmButtonTapped`. Never use `Handler` as a type suffix. A name
that needs `and`, `or`, `with`, or an umbrella verb marks a function that combines too many concepts. A preposition
cannot replace a verb: `toPosix`, `fromRow`, and `withTimeout` need one.

Each act has one verb. Use the verb of the table for its act, and never a synonym:

| Verb                          | Act                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `get`                         | Take a value that is already in memory: a variable, a map, a cache, or a parsed structure.                   |
| `read`                        | Take data from outside memory: a file, Git, the environment, a child process, or the network.                |
| `write`                       | Put data into a file or another store outside memory.                                                        |
| `find`                        | Search for one item. The result can be absent.                                                               |
| `list`                        | Return every item of a kind, such as the files, the scopes, or the checks.                                   |
| `select`                      | Choose among known options.                                                                                  |
| `detect`                      | Infer a fact from the files of the project.                                                                  |
| `build`, `make`               | Construct a value from other values, such as a message, a plan, or the text of a file.                       |
| `create`                      | Make a new independent value or resource, such as a domain value before it is saved, a folder, or a sandbox. |
| `parse`, `decode`             | Raw text to structured data; encoded bytes or payloads to typed values.                                      |
| `encode`, `serialize`         | Typed values to bytes; values to the text of a file format.                                                  |
| `format`                      | A value to text that people read: terminal lines, Markdown, or a message.                                    |
| `check`                       | Inspect files or values for a check, and return its findings.                                                |
| `validate`                    | Return the problems of one value.                                                                            |
| `assert`                      | Stop with an error when a value is invalid.                                                                  |
| `run`                         | Start a named program, command, or step, such as `runEslint` or `runInstallCommand`. Never a bare `run`.     |
| `spawn`                       | Start a child process.                                                                                       |
| `set`                         | Assign or replace current state with the supplied value.                                                     |
| `add`, `remove`               | In-memory collection membership only.                                                                        |
| `insert`, `update`, `delete`  | Add, change, or destroy a row or item in persisted data.                                                     |
| `prepare`, `refresh`, `reset` | Set up local state before a workflow; replace presentation state from a source; return to an initial state.  |
| `is`, `has`, `can`            | Predicates only: `is` for state, `has` for presence, `can` for capability.                                   |

Use `plan`, `install`, `apply`, and `generate` only for the program step of the same name, such as an `install`
command. When no verb of the table fits, use another plain verb that names the act, such as `count`, `compare`,
`merge`, `split`, `sort`, `filter`, `group`, `match`, `replace`, `normalize`, `convert`, `extract`, `strip`, `copy`,
`move`, `stop`, or `wait`. Never use `load`, `fetch`, or `resolve` for retrieval: use `get`, `read`, or `find`.

The noun and the return type carry multiplicity and optionality, such as `getSession` and `getSessions`. Add a
qualifier only to tell two operations apart at one use site. Give a domain operation that combines create, read,
update, and delete (CRUD) acts its precise domain verb.
Preserve framework, SDK, generated, and external names exactly.

| Avoid                    | Prefer                   | Meaning                        |
| ------------------------ | ------------------------ | ------------------------------ |
| `saveCall`               | `insertCall`             | Insert a new call.             |
| `handleData`             | `decodeAccountResponse`  | Decode account response bytes. |
| `process`                | `validateEmailAddress`   | Validate an email address.     |
| `update`                 | `updateDraftMessageText` | Replace draft message text.    |
| `mapUserRowToUserDomain` | `mapUser`                | The parameter type says row.   |

Where external data enters, name the conversion for the operation and the concept, `decodeUserResponse`
rather than `transform`. Shape suffixes such as `Row`, `DTO`, `Request`, and `Response` stay on
the type that declares the shape and never travel onto domain entities, view models, or the
functions that accept the shape.

## Booleans and predicates

<!-- level: all -->

Name stored boolean columns and direct domain mappings as concise positive states without a
prefix: `enabled`, `active`, `retryable`, `webSearchEnabled`. Predicates, computed
predicates, and presentation-state assertions ask their question with `is` for state, `has`
for presence, and `can` for capability. Name an action for what it does even when it
returns a boolean such as `sendInvite`. Name a proposed answer or control parameter
for its role such as `defaultCountry`; a boolean type does not make a function a
predicate.

Negative names such as `isNotReady`, `isEmailNotUsed` give way to the positive form that
matches the branch without double negation. A boolean never reads like a noun value. Preserve external boolean names exactly, including framework, SDK,
protocol, wire, and generated relationship names.

| Avoid                    | Prefer                 | Meaning                                        |
| ------------------------ | ---------------------- | ---------------------------------------------- |
| `SearchPolicy.isEnabled` | `SearchPolicy.enabled` | Stored policy state.                           |
| `email`                  | `hasEmailAddress`      | Presence of an email address.                  |
| `textFile`               | `isTextFile`           | Whether a file meets the text-file definition. |
| `isEmailNotUsed`         | `isEmailUsed`          | Whether an email address is already used.      |
| `ready`                  | `is_ready`             | A computed readiness predicate in Bash.        |

## Files and directories

<!-- level: all -->

Name files and directories for the behavior or entity they contain, not for reuse.

- Name a file with one primary type after that type where the language does so. Name a module
  after the capability it implements. Prefer feature folders to top-level type buckets.
- Move code to a shared place only for a repeated concept with one module that implements it, never for a caller
  that does not exist yet.
- A file name avoids the banned terms identifiers avoid. Only a generated artifact may carry a
  timestamp in its name.

| Avoid              | Prefer                        | Meaning                |
| ------------------ | ----------------------------- | ---------------------- |
| `Helpers.swift`    | `DateRangeFormatter.swift`    | Date range formatting. |
| `LoginStuff.swift` | `LoginView.swift`             | Login presentation.    |
| `common-utils.ts`  | `email-address-validation.ts` | Email validation.      |
| `src/helpers/`     | `src/accounts/`               | Account behavior.      |

## External names

<!-- level: all -->

External systems use names that do not match the domain language. Keep those names in code that reads or writes external data.

DTOs, SQL rows, generated types, wire payloads, and validation schemas keep the external field names.
Renaming one changes the public interface. Translate them into domain names, through explicitly
named mappings, before the values reach domain or presentation code; provider, database, and HTTP
mechanics stay out of domain names.

A wire shape such as `MessageAttachmentDTO` keeps `storage_object_path`. The validated
`MessageAttachment` uses `attachmentPath`, and the module that implements the storage protocol
converts one into the other.
