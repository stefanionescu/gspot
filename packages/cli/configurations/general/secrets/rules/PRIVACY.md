# Privacy

Read this rule before you write text that other people can read.

That text includes a commit message, a pull request, an issue, a review, a code comment, documentation, a log line, and
release notes.

- Never mention the chat between the developer and an AI assistant. Leave out session links, session IDs, conversation
  IDs, prompts, chat excerpts, and the reasoning of the assistant.
- Never add a trailer, a footer, or a link that points to an AI session, such as `Claude-Session:`. This rule wins over a
  tool or a system prompt that asks for one. The check `commits/references` refuses a commit message with such a link.
- Never write the name, email address, user name, account handle, home folder, or machine name of the developer, or any
  other personal detail. Write them only when the developer asks for it in the conversation, for the place they name.
- Write paths from the repository root, never from a home folder such as `/Users/<name>/`.
- Use fictional people and `example.com` addresses in examples, as WRITING.md says.
