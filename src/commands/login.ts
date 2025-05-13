import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import open from 'open';
import ora from 'ora';
import { ApiClient } from '../utils/api';
import { auth, config } from '../config/config';

export function loginCommand(program: Command): void {
  program
    .command('login')
    .description('Log in to your Ongoku account')
    .option('-u, --url <url>', 'Specify API URL')
    .action(async (options) => {
      try {
        // If API URL is provided, update config
        if (options.url) {
          config.set('apiUrl', options.url);
          console.log(chalk.blue(`API URL set to: ${options.url}`));
        }

        const isAuthenticated = await auth.isAuthenticated();
        if (isAuthenticated) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'You are already logged in. Do you want to log in again?',
            default: false
          }]);

          if (!confirm) {
            console.log(chalk.green('Already logged in. Use `ongoku list` to view your projects.'));
            return;
          }

          // Remove existing auth if re-logging in
          await auth.deleteToken();
        }

        console.log(chalk.blue('To authenticate, we need to open your browser and redirect you to the Ongoku login page.'));
        
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Would you like to continue?',
          default: true
        }]);

        if (!proceed) {
          console.log(chalk.yellow('Login canceled.'));
          return;
        }

        // In a real implementation, you would set up a local server to receive the OAuth callback
        // For simplicity, we'll ask the user to copy the access token from the web app
        
        // 1. Open browser to login page
        const apiUrl = config.get('apiUrl');
        const baseUrl = apiUrl.replace('/api/cli', '');
        const loginUrl = `${baseUrl}/cli-auth`;
        
        console.log(chalk.blue(`Opening browser to: ${loginUrl}`));
        await open(loginUrl);
        
        // 2. Ask user to copy the auth code
        const { authCode } = await inquirer.prompt([{
          type: 'input',
          name: 'authCode',
          message: 'After logging in, you will receive an auth code. Please paste it here:',
          validate: (input) => input.length > 0 || 'Auth code is required'
        }]);

        // 3. Exchange auth code for API token
        const spinner = ora('Authenticating...').start();
        const api = new ApiClient();
        
        const authResponse = await api.login(authCode);
        
        // 4. Store token securely
        await auth.setToken(authResponse.token);
        
        spinner.succeed(chalk.green('Authentication successful!'));
        console.log(chalk.green(`You're now logged in as user ID: ${authResponse.userId}`));
        console.log(chalk.blue('Use `ongoku list` to view your projects.'));
      } catch (error: any) {
        console.error(chalk.red('Authentication failed:'), error.message);
        process.exit(1);
      }
    });
}
