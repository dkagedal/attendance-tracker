const fs = require("fs");
const path = require("path");

// Determine target environment.
// If APP_ENV is explicitly set, we must use it.
// If not set, keep existing config.ts if present, otherwise initialize with 'emulator'.
let appEnv = process.env.APP_ENV;
const srcDir = path.resolve(__dirname, "../packages/frontend/src");
const targetFile = path.join(srcDir, "config.ts");

if (!appEnv) {
  if (fs.existsSync(targetFile)) {
    console.log("APP_ENV not set; keeping existing config.ts");
    process.exit(0);
  }
  appEnv = "emulator";
}

const sourceFile = path.join(srcDir, `config-${appEnv}.ts`);

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

if (
  fs.existsSync(targetFile) &&
  fs.readFileSync(sourceFile).equals(fs.readFileSync(targetFile))
) {
  console.log(`Active configuration already matches config-${appEnv}.ts`);
  process.exit(0);
}

fs.copyFileSync(sourceFile, targetFile);
console.log(
  `Successfully set active configuration: config-${appEnv}.ts -> config.ts`
);
