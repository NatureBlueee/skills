/**
 * npm lifecycle entry point.
 *
 * Deliberately tiny: ALL logic lives in src/installer.ts so the npm hook and
 * the `wowok-skills` CLI share one implementation (the two used to be
 * duplicated and drifted apart).
 *
 *   postinstall → copy SKILL.md to every client + register the MCP server
 *
 * There is NO uninstall hook: npm v7+ never runs `preuninstall`/`uninstall`
 * scripts, so removal is an explicit command — `wowok-skills uninit`.
 *
 * Environment variables:
 *   WOWOK_SKILLS_TARGETS  comma-separated target ids (default: all)
 *   WOWOK_SKILLS_NO_MCP   "1" to skip MCP install/registration
 *   WOWOK_REFERRER        airdrop referrer (address or name) to persist
 */

const path = require('path');
const fs = require('fs');

const dist = path.join(__dirname, '..', 'dist', 'installer.js');

if (!fs.existsSync(dist)) {
  console.warn(
    '[wowok-skills] dist/installer.js is missing — skills were NOT installed.\n' +
      '[wowok-skills] Build the package first (npm run build) or reinstall from the npm registry.',
  );
  process.exit(0);
}

const { runLifecycle } = require(dist);
runLifecycle(process.env.npm_lifecycle_event || '');
