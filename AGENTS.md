# FlowOn Codex Rules

- Use `https://github.com/jeremylowzhiyancode/flowon` as the canonical GitHub repository URL for FlowOn.
- Before major product or implementation decisions, check recent related side chats for updated user answers and constraints.
- Make periodic Git saves at stable checkpoints.
- Do not commit unless security checks pass first.
- Security checks must include at minimum:
  - `git status --short --branch`
  - scan staged and unstaged files for likely secrets, API keys, tokens, and private data
  - confirm `.env`, local logs, generated secrets, and private user data are not staged
  - run available project checks or tests when they exist
- If a security check cannot be run, say so before committing.
