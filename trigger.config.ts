import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Your Trigger.dev project ref (cloud.trigger.dev → Project settings). Not a secret.
  project: "proj_REPLACE_ME",
  dirs: ["./src/trigger"],
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      randomize: true,
    },
  },
  build: {
    // react-pdf uses WebAssembly (yoga layout), so it is installed, not bundled.
    external: ["@react-pdf/renderer"],
  },
});
