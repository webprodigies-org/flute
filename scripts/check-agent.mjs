// Installed guide examples and external-agent source must survive the real public workflow.
process.env.FLUTE_VERIFY_AGENT='1';
await import('./check-installed.mjs');
