import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
<<<<<<< HEAD
  project: "proj_zeeijbuctavwwdhzkrab",
=======
  project: "proj_cmmfqgbnrcsmfinrucgk",
>>>>>>> 37cad1f5f8b932ea098a524e809e7d29f5208bcb
  runtime: "node",
  /** `log` = info+ ; `debug` = includes per-step Apify detail. Shown in `pnpm trigger:dev` CLI. */
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});
