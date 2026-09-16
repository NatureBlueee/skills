/**
 * Single source of truth for everything related to WHERE things get installed.
 *
 * Both entry points consume this module:
 *   - the npm lifecycle hook (scripts/install.js → dist/installer.js)
 *   - the `wowok-skills` CLI  (src/cli.ts)
 *
 * NEVER hardcode a skill name or a client directory anywhere else.
 *
 * Directory choices below are taken from each client's official documentation
 * (verified 2026-09). Where a client only documents a UI flow (no on-disk
 * path), no path is registered here — the CLI prints a manual hint instead.
 */

import * as os from 'os';
import * as path from 'path';

// =========================================================================
// Skills
// =========================================================================

/**
 * Retained skills. Rule-reference skills (guard/tools/safety/scenario) were
 * sunk into the MCP knowledge layer in v2.0 and MUST NOT be installed.
 */
export const SKILL_NAMES: readonly string[] = [
  'wowok-provider',
  'wowok-supplier',
  'wowok-collaborator',
  'wowok-arbitrator',
  'wowok-machine',
  'wowok-order',
  'wowok-messenger',
  'wowok-output',
  'wowok-onboard',
  'wowok-planner',
  'wowok-auditor',
  'wowok-market',
  'wowok-governance',
];

/** Deprecated skill dirs — never installed, always cleaned up when found. */
export const LEGACY_SKILL_NAMES: readonly string[] = [
  'wowok-guard',
  'wowok-tools',
  'wowok-safety',
  'wowok-scenario',
];

/** Where each deprecated skill's content now lives (migration message). */
export const SKILL_MIGRATION_TARGETS: Record<string, string> = {
  'wowok-safety': "MCP schema_query action='get_safety_rules'",
  'wowok-tools': "MCP schema_query action='get_tool_reference'",
  'wowok-scenario': "MCP industry_pack_operation action='recommend_industry' / 'list_modes'",
  'wowok-guard': "MCP schema_query action='get_guard_design_patterns'",
};

/** Per-root install manifest (freshness + ownership tracking). */
export const MANIFEST_FILE = '.wowok-skills.json';

/** The MCP server npm package this tool installs and registers. */
export const MCP_PACKAGE = '@wowok/agent-mcp';

// =========================================================================
// Skill roots (cross-client standard + per-client native)
// =========================================================================

/** Cross-client root read by Codex, Cursor, Windsurf, Roo, Kilo (+ Trae project). */
export const AGENTS_SKILL_ROOT = '.agents/skills';

export const CLAUDE_SKILL_ROOT = '.claude/skills';
export const CODEX_SKILL_ROOT = '.agents/skills';
export const CURSOR_SKILL_ROOT = '.cursor/skills';
export const WINDSURF_SKILL_ROOT = '.windsurf/skills';
export const CODEBUDDY_SKILL_ROOT = '.codebuddy/skills';
export const TRAE_SKILL_ROOT = '.trae/skills';
export const QODER_SKILL_ROOT = '.qoder/skills';
export const ROO_SKILL_ROOT = '.roo/skills';
export const CLINE_SKILL_ROOT = '.cline/skills';
export const KILO_SKILL_ROOT = '.kilo/skills';
export const COPILOT_SKILL_ROOT = '.github/skills';

// =========================================================================
// MCP registration
// =========================================================================

export interface McpLaunch {
  command: string;
  args: string[];
}

export interface McpSpec {
  scope: 'user' | 'project';
  /** Absolute path for user scope, project-relative for project scope. */
  path: string;
  /**
   * json       → `{ "mcpServers": { "wowok": { command, args } } }`
   * toml       → `[mcp_servers.wowok]` (Codex)
   * kilo-json  → `{ "mcp": { "wowok": { type: "local", command: [...] } } }` (Kilo new platform)
   */
  format: 'json' | 'toml' | 'kilo-json';
  /** JSON only: extra fields merged into the server entry (e.g. type/tools). */
  extraEntry?: Record<string, unknown>;
  /** Free-form note printed when the file cannot be managed automatically. */
  note?: string;
}

export type ClientTargetId =
  | 'agents'
  | 'claude'
  | 'codex'
  | 'cursor'
  | 'windsurf'
  | 'codebuddy'
  | 'trae'
  | 'qoder'
  | 'roo'
  | 'cline'
  | 'kilo'
  | 'copilot';

export interface ClientTarget {
  id: ClientTargetId;
  label: string;
  /** User-scope skill roots ('~' is expanded to the home directory). */
  userSkillDirs: string[];
  /** Project-scope skill roots, relative to the project root. */
  projectSkillDirs: string[];
  /** User-scope MCP config files. */
  userMcp: McpSpec[];
  /** Project-scope MCP config files (written by `wowok-skills init`). */
  projectMcp: McpSpec[];
  /** Stale artifacts from installers older than v3.1 that must be cleaned up. */
  legacyUserDirs?: string[];
  legacyProjectDirs?: string[];
  /**
   * MCP config files an older installer wrote to but the client never reads.
   * The `wowok` entry is removed from them (never the rest of the file).
   */
  legacyMcpFiles?: string[];
  /** Manual steps that cannot be automated (printed by init/doctor). */
  notes?: string[];
}

const home = (): string => os.homedir();

/** Kilo Code new-platform config dir (XDG style). */
function kiloConfigDir(): string {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home(), '.config'), 'kilo');
}

/**
 * Pre-3.1 installers registered Qoder's MCP server in an undocumented
 * `mcp-settings.json` inside the app data dir. Qoder actually reads
 * `~/.qoder/settings.json`, so that file only carries a stale entry.
 */
function qoderLegacyMcpFile(): string {
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA || path.join(home(), 'AppData', 'Roaming')
      : process.platform === 'darwin'
        ? path.join(home(), 'Library', 'Application Support')
        : process.env.XDG_CONFIG_HOME || path.join(home(), '.config');
  return path.join(base, 'Qoder', 'mcp-settings.json');
}

/** Locale-independent Trae user data root: prefer the edition that exists. */
function traeSkillRoot(): string {
  const cn = path.join(home(), '.trae-cn');
  const intl = path.join(home(), '.trae');
  if (existsDir(cn)) return path.join(cn, 'skills');
  if (existsDir(intl)) return path.join(intl, 'skills');
  // Neither edition detected — default to the CN edition (primary market).
  return path.join(cn, 'skills');
}

/** Trae keeps user-level MCP config inside its Electron user-data dir. */
function traeMcpPaths(): string[] {
  const roots =
    process.platform === 'win32'
      ? [process.env.APPDATA || path.join(home(), 'AppData', 'Roaming')]
      : process.platform === 'darwin'
        ? [path.join(home(), 'Library', 'Application Support')]
        : [process.env.XDG_CONFIG_HOME || path.join(home(), '.config')];
  const editions = ['Trae CN', 'Trae', 'TRAE SOLO CN'];
  const out: string[] = [];
  for (const root of roots) {
    for (const edition of editions) {
      const userDir = path.join(root, edition, 'User');
      if (existsDir(userDir)) out.push(path.join(userDir, 'mcp.json'));
    }
  }
  return out;
}

/** VS Code & variants user dirs (extensions keep MCP settings in globalStorage). */
function vscodeUserDirs(): string[] {
  const roots =
    process.platform === 'win32'
      ? [process.env.APPDATA || path.join(home(), 'AppData', 'Roaming')]
      : process.platform === 'darwin'
        ? [path.join(home(), 'Library', 'Application Support')]
        : [process.env.XDG_CONFIG_HOME || path.join(home(), '.config')];
  const variants = ['Code', 'Code - Insiders', 'VSCodium', 'Cursor'];
  const out: string[] = [];
  for (const root of roots) {
    for (const variant of variants) {
      const dir = path.join(root, variant, 'User');
      if (existsDir(dir)) out.push(dir);
    }
  }
  return out;
}

/** MCP settings file used by a VS Code extension, for every installed variant. */
function vscodeGlobalStorageFiles(extensionId: string, fileName: string): string[] {
  return vscodeUserDirs().map((userDir) =>
    path.join(userDir, 'globalStorage', extensionId, 'settings', fileName),
  );
}

function existsDir(dir: string): boolean {
  try {
    return require('fs').statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function fsExists(p: string): boolean {
  try {
    return require('fs').existsSync(p);
  } catch {
    return false;
  }
}

export const CLIENT_TARGETS: readonly ClientTarget[] = [
  {
    id: 'agents',
    label: 'Cross-client (.agents/skills)',
    userSkillDirs: [path.join(home(), AGENTS_SKILL_ROOT)],
    projectSkillDirs: [AGENTS_SKILL_ROOT],
    // Read by Codex, Cursor, Windsurf, Roo, Kilo (and Trae project-level,
    // once "enable .agents skills directory" is turned on).
    userMcp: [],
    projectMcp: [],
  },
  {
    id: 'claude',
    label: 'Claude Code',
    userSkillDirs: [path.join(home(), CLAUDE_SKILL_ROOT)],
    projectSkillDirs: [CLAUDE_SKILL_ROOT],
    // Official: user scope lives in ~/.claude.json, project scope in .mcp.json.
    // ~/.claude/settings.json carries only approval flags — never MCP servers.
    userMcp: [{ scope: 'user', path: path.join(home(), '.claude.json'), format: 'json' }],
    projectMcp: [{ scope: 'project', path: '.mcp.json', format: 'json' }],
    // settings.json never carried MCP servers — only approval flags.
    legacyMcpFiles: [path.join(home(), '.claude', 'settings.json')],
  },
  {
    id: 'codex',
    label: 'OpenAI Codex CLI / ChatGPT Codex mode',
    // Official docs list the cross-client .agents root. Codex ALSO keeps a user
    // skill root at ~/.codex/skills (it ships bundled skills in
    // ~/.codex/skills/.system with a .codex-system-skills.marker), so we write
    // to both — one of the two is guaranteed to be read.
    userSkillDirs: [path.join(home(), AGENTS_SKILL_ROOT), path.join(home(), '.codex', 'skills')],
    projectSkillDirs: [AGENTS_SKILL_ROOT],
    userMcp: [{ scope: 'user', path: path.join(home(), '.codex', 'config.toml'), format: 'toml' }],
    projectMcp: [{ scope: 'project', path: '.codex/config.toml', format: 'toml' }],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    userSkillDirs: [path.join(home(), CURSOR_SKILL_ROOT)],
    projectSkillDirs: [CURSOR_SKILL_ROOT],
    userMcp: [{ scope: 'user', path: path.join(home(), '.cursor', 'mcp.json'), format: 'json' }],
    projectMcp: [{ scope: 'project', path: '.cursor/mcp.json', format: 'json' }],
    // Pre-3.1 installers wrote agent-requested `.mdc` rules instead of skills.
    legacyUserDirs: [path.join(home(), '.cursor', 'rules')],
    legacyProjectDirs: ['.cursor/rules'],
  },
  {
    id: 'windsurf',
    label: 'Windsurf (Cascade)',
    userSkillDirs: [path.join(home(), '.codeium', 'windsurf', 'skills')],
    projectSkillDirs: [WINDSURF_SKILL_ROOT],
    // Only the user-scope MCP file is documented for Windsurf.
    userMcp: [
      {
        scope: 'user',
        path: path.join(home(), '.codeium', 'windsurf', 'mcp_config.json'),
        format: 'json',
      },
    ],
    projectMcp: [],
    // ~/.windsurf/skills was never read by Windsurf (rules/workflows live there).
    legacyUserDirs: [path.join(home(), '.windsurf', 'skills')],
  },
  {
    id: 'codebuddy',
    label: 'CodeBuddy',
    userSkillDirs: [path.join(home(), '.codebuddy', 'skills')],
    projectSkillDirs: [CODEBUDDY_SKILL_ROOT],
    // Priority 1 of the documented user-scope candidates.
    userMcp: [{ scope: 'user', path: path.join(home(), '.codebuddy', '.mcp.json'), format: 'json' }],
    // CodeBuddy project scope is <project>/.mcp.json — the same file Claude uses.
    projectMcp: [{ scope: 'project', path: '.mcp.json', format: 'json' }],
  },
  {
    id: 'trae',
    label: 'Trae (CN & international)',
    userSkillDirs: [traeSkillRoot()],
    projectSkillDirs: [TRAE_SKILL_ROOT],
    userMcp: traeMcpPaths().map((p) => ({ scope: 'user' as const, path: p, format: 'json' as const })),
    projectMcp: [{ scope: 'project', path: '.trae/mcp.json', format: 'json' }],
  },
  {
    id: 'qoder',
    label: 'Qoder',
    userSkillDirs: [path.join(home(), '.qoder', 'skills')],
    projectSkillDirs: [QODER_SKILL_ROOT],
    userMcp: [{ scope: 'user', path: path.join(home(), '.qoder', 'settings.json'), format: 'json' }],
    projectMcp: [{ scope: 'project', path: '.mcp.json', format: 'json' }],
    legacyMcpFiles: [qoderLegacyMcpFile()],
  },
  {
    id: 'roo',
    label: 'Roo Code',
    userSkillDirs: [path.join(home(), '.roo', 'skills')],
    projectSkillDirs: [ROO_SKILL_ROOT],
    userMcp: vscodeGlobalStorageFiles(
      'rooveterinaryinc.roo-cline',
      'cline_mcp_settings.json',
    ).map((p) => ({ scope: 'user' as const, path: p, format: 'json' as const })),
    projectMcp: [{ scope: 'project', path: '.roo/mcp.json', format: 'json' }],
    // Roo is a VS Code extension: its global MCP file is the globalStorage one.
    legacyMcpFiles: [path.join(home(), '.roo', 'mcp_settings.json')],
  },
  {
    id: 'cline',
    label: 'Cline',
    userSkillDirs: [path.join(home(), '.cline', 'skills')],
    projectSkillDirs: [CLINE_SKILL_ROOT],
    userMcp: [
      { scope: 'user', path: path.join(home(), '.cline', 'mcp.json'), format: 'json' },
      ...vscodeGlobalStorageFiles('saoudrizwan.claude-dev', 'cline_mcp_settings.json').map(
        (p) => ({ scope: 'user' as const, path: p, format: 'json' as const }),
      ),
    ],
    projectMcp: [],
  },
  {
    id: 'kilo',
    label: 'Kilo Code',
    userSkillDirs: [path.join(home(), '.kilo', 'skills')],
    projectSkillDirs: [KILO_SKILL_ROOT],
    userMcp: [
      ...vscodeGlobalStorageFiles('kilocode.kilo-code', 'mcp_settings.json').map((p) => ({
        scope: 'user' as const,
        path: p,
        format: 'json' as const,
      })),
      {
        scope: 'user',
        path: path.join(home(), '.kilocode', 'cli', 'global', 'settings', 'mcp_settings.json'),
        format: 'json',
      },
      // New platform: `mcp` key inside kilo.json. `kilo.jsonc` also works but is
      // never rewritten — that would silently drop the user's comments.
      ...(fsExists(path.join(kiloConfigDir(), 'kilo.jsonc'))
        ? []
        : [
            {
              scope: 'user' as const,
              path: path.join(kiloConfigDir(), 'kilo.json'),
              format: 'kilo-json' as const,
            },
          ]),
    ],
    projectMcp: [],
    notes: fsExists(path.join(kiloConfigDir(), 'kilo.jsonc'))
      ? [
          `Kilo Code uses ${path.join(kiloConfigDir(), 'kilo.jsonc')}, which this tool never rewrites (comments would be lost). ` +
            'Add the server there manually under the "mcp" key.',
        ]
      : [],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot (VS Code & CLI)',
    userSkillDirs: [path.join(home(), '.copilot', 'skills')],
    projectSkillDirs: [COPILOT_SKILL_ROOT],
    userMcp: [
      {
        scope: 'user',
        path: path.join(home(), '.copilot', 'mcp-config.json'),
        format: 'json',
        extraEntry: { type: 'stdio', tools: ['*'] },
      },
    ],
    projectMcp: [
      {
        scope: 'project',
        path: '.github/mcp.json',
        format: 'json',
        extraEntry: { type: 'stdio', tools: ['*'] },
      },
    ],
    // Pre-3.1 installers wrote `.prompt.md` files here (workspace-only path,
    // never scanned for user-level prompts). Copilot reads skills now.
    legacyUserDirs: [path.join(home(), '.github', 'prompts')],
    legacyProjectDirs: ['.github/prompts'],
  },
];

export const DEFAULT_TARGET_IDS: readonly ClientTargetId[] = CLIENT_TARGETS.map((t) => t.id);

export function getClientTarget(id: string): ClientTarget | undefined {
  return CLIENT_TARGETS.find((t) => t.id === id);
}

/** Expand a leading `~` and normalise separators. */
export function expandHome(p: string): string {
  if (p === '~') return home();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(home(), p.slice(2));
  return p;
}

/**
 * Resolve every (target × scope) skill root to a unique absolute directory.
 * `~/.agents/skills` is shared by several targets and is written only once.
 */
export function resolveSkillRoots(
  targetIds: readonly string[],
  scope: 'user' | 'project',
  cwd: string,
): string[] {
  const roots: string[] = [];
  for (const id of targetIds) {
    const target = getClientTarget(id);
    if (!target) continue;
    const dirs = scope === 'user' ? target.userSkillDirs : target.projectSkillDirs;
    for (const dir of dirs) {
      const abs = scope === 'user' ? expandHome(dir) : path.resolve(cwd, dir);
      if (!roots.includes(abs)) roots.push(abs);
    }
  }
  return roots;
}

/** Resolve every MCP config file for the given targets and scope. */
export function resolveMcpSpecs(
  targetIds: readonly string[],
  scope: 'user' | 'project',
  cwd: string,
): McpSpec[] {
  const specs: McpSpec[] = [];
  const seen = new Set<string>();
  for (const id of targetIds) {
    const target = getClientTarget(id);
    if (!target) continue;
    const list = scope === 'user' ? target.userMcp : target.projectMcp;
    for (const spec of list) {
      const abs = scope === 'user' ? expandHome(spec.path) : path.resolve(cwd, spec.path);
      if (seen.has(abs)) continue;
      seen.add(abs);
      specs.push({ ...spec, path: abs });
    }
  }
  return specs;
}
