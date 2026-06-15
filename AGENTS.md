# Agent Instructions

## Stack

This project is a Rust and htmx codebase. Prefer Rust for application logic,
rendering, ingestion, and tests. Use htmx for browser interactions.

## Copy and Voice

Do not write public-facing copy in Miguel's voice.

Machine-generated copy is allowed only as internal draft material in admin
surfaces. Label it as draft copy, keep it editable/review-only, and never treat
it as final public-facing copy.

When a change needs newsletter/site copy, labels with personality, value
propositions, taglines, blurbs, issue descriptions, onboarding text, or similar
voice-sensitive language, describe the copy slot instead of drafting the final
sentence. Include:

- where the copy will appear
- what job the line needs to do
- any length or layout constraints

Then wait for Miguel to provide the exact copy.

## LLM Usage

Prefer the smallest useful model and bounded prompts. Validate prompt shape
locally with LM Studio when practical, then use Cloudflare Workers AI in
production with explicit token limits and manual/on-demand generation so costs
stay low.

## Deployment

Always deploy completed changes. For this project, push to `main` and verify
the GitHub Actions deploy jobs complete successfully unless Miguel explicitly
asks not to deploy.
