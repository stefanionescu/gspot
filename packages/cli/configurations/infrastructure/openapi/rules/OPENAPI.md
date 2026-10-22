# OpenAPI

Read this rule when you change an OpenAPI document or its contract tests.

## Public contracts

When the project publishes OpenAPI, its document describes the runtime API.

- Keep required fields, types, accepted media types, status codes, and security requirements consistent between the
  document and the implementation.
- Keep the schema library the project uses, and write the document with the command in `openapi.generate_command`.
- Keep request and response examples valid against their schemas.
- Document error responses and nullable or optional values precisely.

## Contract tests

When you write contract tests:

- Validate representative success and error responses against the published schemas.
- Exercise invalid body, query, and route values through HTTP and assert their declared errors.
- Verify authentication and authorization requirements for protected operations.
- Test the public response. Assert its status and content type.

An assertion that checks only some fields does not prove that the whole response satisfies its schema. Use the project's
schema validator for that claim.
