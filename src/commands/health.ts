import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../utils/api';
import { config } from '../config/config';

export function healthCommand(program: Command): void {
  program
    .command('health')
    .description('Check API connectivity')
    .action(async () => {
      const api = new ApiClient();
      const spinner = ora('Checking API connectivity...').start();
      
      try {
        // Try to hit the health endpoint with no auth required
        const result = await api.checkHealth();
        spinner.succeed(`API connection successful: ${result.status}`);
        
        console.log(chalk.blue('API Service:'), result.service);
        console.log(chalk.blue('API Version:'), result.version);
        console.log(chalk.blue('API URL:'), config.get('apiUrl'));
        console.log(chalk.blue('Timestamp:'), result.timestamp);
        
      } catch (error: any) {
        spinner.fail('API connection failed');
        console.error(chalk.red('Error:'), error.message);
        
        // Display additional troubleshooting info
        console.log('\nTroubleshooting:');
        console.log('1. Make sure the Ongoku server is not down');
        console.log(`2. Check if the API URL is correct: ${config.get('apiUrl')}`);
      }
    });
}
