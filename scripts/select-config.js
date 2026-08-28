const fs = require("fs");
const path = require("path");

// Determine target environment.
// If APP_ENV is explicitly set, we must use it.
// If not set, we'll try to default to 'live' if the file exists,
// or fallback to 'emulator' if 'live' doesn't exist.
let appEnv = process.env.APP_ENV;
const srcDir = path.resolve(__dirname, "../packages/frontend/src");

if (!appEnv) {
  const liveFile = path.join(srcDir, "config-live.ts");
  if (fs.existsSync(liveFile)) {
    appEnv = "live";
  } else {
    appEnv = "emulator";
  }
}

const sourceFile = path.join(srcDir, `config-${appEnv}.ts`);
const targetFile = path.join(srcDir, "config.ts");

console.log(`Selecting configuration for environment: ${appEnv}`);

if (!fs.existsSync(sourceFile)) {
  console.error(
    `Error: Configuration file for environment '${appEnv}' not found: ${sourceFile}`
  );
  console.error(
    `Please make sure this file exists before building or deploying.`
  );
  process.exit(1);
}

fs.copyFileSync(sourceFile, targetFile);
console.log(
  `Successfully set active configuration: config-${appEnv}.ts -> config.ts`
);
