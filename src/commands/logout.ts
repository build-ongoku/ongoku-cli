import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { auth } from '../config/config';

export function logoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Log out from your Ongoku account')
    .action(async () => {
      try {
        const isAuthenticated = await auth.isAuthenticated();
        
        if (!isAuthenticated) {
          console.log(chalk.yellow('You are not logged in.'));
          return;
        }

        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to log out?',
          default: false
        }]);

        if (!confirm) {
          console.log(chalk.blue('Logout canceled.'));
          return;
        }

        const spinner = ora('Logging out...').start();
        
        const success = await auth.deleteToken();
        
        if (success) {
          spinner.succeed(chalk.green('Successfully logged out.'));
        } else {
          spinner.fail(chalk.red('Failed to remove authentication data.'));
        }
      } catch (error: any) {
        console.error(chalk.red('Logout failed:'), error.message);
      }
    });
}
