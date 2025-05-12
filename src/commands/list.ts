import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { format } from 'date-fns';
import { ApiClient } from '../utils/api';
import { auth } from '../config/config';

export function listCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List all your Ongoku projects')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options) => {
      try {
        // Check if authenticated
        const isAuthenticated = await auth.isAuthenticated();
        if (!isAuthenticated) {
          console.log(chalk.yellow('You are not logged in. Please run `ongoku login` first.'));
          return;
        }

        const spinner = ora('Fetching projects...').start();
        
        const api = new ApiClient();
        const projects = await api.getProjects();
        
        spinner.stop();
        
        if (projects.length === 0) {
          console.log(chalk.yellow('You don\'t have any projects yet.'));
          console.log(chalk.blue('Create a project in the Ongoku web app to get started.'));
          return;
        }

        // Output in JSON format if requested
        if (options.json) {
          console.log(JSON.stringify(projects, null, 2));
          return;
        }

        // Output in a nice table format
        console.log(chalk.bold('\nYour Ongoku projects:\n'));
        
        const headers = ['Name', 'Status', 'Created', 'GitHub'];
        
        // Calculate max widths
        const maxNameWidth = Math.max(...projects.map((p: any) => p.name.length), headers[0].length);
        const maxStatusWidth = Math.max(...projects.map((p: any) => p.status.length), headers[1].length);
        
        // Print header
        console.log(
          chalk.blue(headers[0].padEnd(maxNameWidth + 2)),
          chalk.blue(headers[1].padEnd(maxStatusWidth + 2)),
          chalk.blue(headers[2].padEnd(12)),
          chalk.blue(headers[3])
        );
        
        // Print separator
        console.log(
          ''.padEnd(maxNameWidth + 2, '-'),
          ''.padEnd(maxStatusWidth + 2, '-'),
          ''.padEnd(12, '-'),
          ''.padEnd(40, '-')
        );
        
        // Print each project
        for (const project of projects) {
          const createdDate = project.created_at 
            ? format(new Date(project.created_at), 'yyyy-MM-dd')
            : 'N/A';
          
          const github = project.github_repo_url || 'Not linked';
          
          // Color the status
          let statusColor;
          switch (project.status.toLowerCase()) {
            case 'initialized':
              statusColor = chalk.green;
              break;
            case 'initializing':
              statusColor = chalk.yellow;
              break;
            case 'failed':
              statusColor = chalk.red;
              break;
            default:
              statusColor = chalk.blue;
          }
          
          console.log(
            chalk.white(project.name.padEnd(maxNameWidth + 2)),
            statusColor(project.status.padEnd(maxStatusWidth + 2)),
            chalk.dim(createdDate.padEnd(12)),
            chalk.dim(github)
          );
        }
        
        console.log(`\nTotal: ${projects.length} project${projects.length !== 1 ? 's' : ''}\n`);
        console.log(chalk.blue('To clone a project, run:'), chalk.white('ongoku clone <project-name>'));
      } catch (error: any) {
        console.error(chalk.red('Failed to list projects:'), error.message);
      }
    });
}
