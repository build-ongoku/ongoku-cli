import { Command } from 'commander';
import chalk from 'chalk';
import { config, DEFAULT_API_URL } from '../config/config';

export function configCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage CLI configuration');

  // Get a config value
  configCmd
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key to get')
    .action((key) => {
      const value = config.get(key);
      if (value !== undefined) {
        console.log(value);
      } else {
        console.log(chalk.yellow(`Configuration key '${key}' not found`));
      }
    });

  // Set a config value
  configCmd
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key to set')
    .argument('<value>', 'Value to set')
    .action((key, value) => {
      config.set(key, value);
      console.log(chalk.green(`Set ${key} to ${value}`));
    });

  // List all config values
  configCmd
    .command('list')
    .description('List all configuration values')
    .action(() => {
      const allConfig = config.store;
      console.log(chalk.bold('Current Configuration:'));
      for (const [key, value] of Object.entries(allConfig)) {
        console.log(`${chalk.blue(key)}: ${value}`);
      }
    });

  // Reset config to defaults
  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => {
      // Reset to the default API URL (imported from config.ts)
      config.set('apiUrl', DEFAULT_API_URL);
      console.log(chalk.green('Configuration reset to defaults'));
      console.log(chalk.blue('API URL:'), config.get('apiUrl'));
    });
}
