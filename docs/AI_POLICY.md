# AI policy & provenance

## Pipeline
```
User action → Policy gate (server) → Authorization → Context builder (team-scoped retrieval)
→ Provider adapter → Generated artifact (ai_action_logs + annotation provenance=ai) → Human review → Optional permitted use
```

## Guarantees
- Student-authored text is never overwritten. AI suggestions are stored as separate annotations (`provenance = ai`, field `ai_suggestion:<action>`), the student's version remains authoritative.
- Every AI action is logged: user, team, action, policy version, decision, referenced entities, provider, model, prompt, output hash, disposition (pending/accepted/rejected/blocked).
- Blocked attempts are logged too (transparency), and tracked as `policy.action_blocked` (IDs only).
- "Ask Project History" always runs deterministic retrieval first and cites objects (`[test:ID]`, `[decision:ID]`, `[annotation:ID]`). Generative phrasing is only layered on top when the gate allows and a provider is enabled; the system prompt forbids inventing rationale, results or decisions and requires "not documented" for gaps.
- Reflections (`generate_reflection`) are BLOCKED in every seeded profile.

## Providers
`AI_PROVIDER=disabled` (default) · `fake` (deterministic development adapter, clearly labelled in output) · `openai-compatible` (`AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). The application boots and all Evidence Core features work with the provider disabled.
