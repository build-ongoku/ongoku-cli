#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

// Import command handlers with explicit paths
import { loginCommand } from './commands/login';
import { listCommand } from './commands/list';
import { cloneCommand } from './commands/clone';
import { pushCommand } from './commands/push';
import { pullCommand } from './commands/pull';
import { logoutCommand } from './commands/logout';
import { healthCommand } from './commands/health';
import { configCommand } from './commands/config';
import { projectCommand } from './commands/project';
import { config } from './config/config';

// Create the CLI program
const program = new Command();

// Set up basic information
// Get version from package.json
const packageJson = require('../package.json');

program
  .name('ongoku')
  .description('Command-line tool for Ongoku project management')
  .version(packageJson.version);

// Register commands
loginCommand(program);
logoutCommand(program);
listCommand(program);
cloneCommand(program);
pushCommand(program);
pullCommand(program);
healthCommand(program);
configCommand(program);
projectCommand(program);

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`\nInvalid command: ${program.args.join(' ')}`));
  console.log(`See ${chalk.blue('--help')} for a list of available commands.\n`);
  process.exit(1);
});

// Check for updates periodically
const checkForUpdates = async () => {
  // In a production setting, you'd implement update checking logic here
  // For now, we'll simply log the current version from package.json
  const packageJson = require('../package.json');
  const currentVersion = packageJson.version;
  console.log(chalk.dim(`\nOngoku CLI version ${currentVersion}`));
};

// Show configured API endpoint in verbose mode
if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
  console.log(chalk.dim(`Using API endpoint: ${config.get('apiUrl')}`));
}

// Run the CLI
async function main() {
  try {
    // Only check for updates once per day
    const lastUpdateCheck = config.get('lastUpdateCheck');
    const now = Date.now();
    if (!lastUpdateCheck || now - lastUpdateCheck > 24 * 60 * 60 * 1000) {
      await checkForUpdates();
      config.set('lastUpdateCheck', now);
    }

    program.parse(process.argv);

    // If no command is provided, show help
    if (process.argv.length <= 2) {
      program.help();
    }
  } catch (error) {
    console.error(chalk.red('An unexpected error occurred:'), error);
    process.exit(1);
  }
}

main();
