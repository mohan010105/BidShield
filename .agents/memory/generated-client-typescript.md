---
name: Generated client TypeScript
description: TypeScript library settings needed by generated API client fetch helpers.
---

Generated API clients can use `Headers.entries()` in their fetch helpers. The client library's TypeScript configuration must include both `dom` and `dom.iterable` in its `lib` list or the generated declarations fail typechecking.

**Why:** Orval generated code compiled successfully but the workspace library check rejected `Headers.entries()` when only the DOM library was enabled.

**How to apply:** When regenerating API hooks in this workspace, keep the API client library configured with DOM iterable types before running the library typecheck.