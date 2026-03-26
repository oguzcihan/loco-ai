import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';

const CONFIG_DIR = path.join(os.homedir(), '.loco');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  defaultModel: 'qwen3.5:0.8b',
  setupComplete: false,
};

export function getConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ...DEFAULTS };
    }
    // File exists but is corrupt
    console.error(
      chalk.yellow('⚠'),
      `Could not parse config at ${CONFIG_PATH}, using defaults.`
    );
    return { ...DEFAULTS };
  }
}

export function saveConfig(updates) {
  const current = getConfig();
  const merged = { ...current, ...updates };

  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + '\n');
  } catch (err) {
    throw new Error(`Could not write config to ${CONFIG_PATH}: ${err.message}`);
  }

  return merged;
}
