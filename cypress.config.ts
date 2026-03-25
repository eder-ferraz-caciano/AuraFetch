import { defineConfig } from "cypress";
import { generateLargeFile, cleanupTempFiles } from "./cypress/tasks/file-tasks";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    setupNodeEvents(on) {
      on("task", { generateLargeFile, cleanupTempFiles });
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
  },
});
