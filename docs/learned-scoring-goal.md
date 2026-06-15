# Learned Scoring Goal

Set up a low-cost learned ranking model that runs in Cloudflare without
external model keys. Train it from editorial decisions and seeded SpaceNews
examples, store model weights in D1, and blend the learned score into the
existing deterministic story ranking while keeping unreviewed output inside
the admin workflow.
