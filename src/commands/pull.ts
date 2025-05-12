import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import { ApiClient } from '../utils/api';
import {
  checkAuthentication,
  resolveProjectDir,
  verifyGitRepository,
  getProjectIdentifiers,
  findProject,
  getGitCredentials,
  withErrorHandling,
  isOngokuProject
} from '../utils/common';

export function pullCommand(program: Command): void {
  program
    .command('pull')
    .description('Pull latest changes from your Ongoku project')
    .option('-d, --directory <directory>', 'Project directory (defaults to current directory)')
    .option('-f, --force', 'Force pull even if there are local changes')
    .action(async (options) => {
      // Check authentication first
      if (!await checkAuthentication()) return;

      await withErrorHandling(async (spinner) => {
        // 1. Setup and validation
        const projectDir = resolveProjectDir(options.directory);
        
        // Verify this is an Ongoku project (has ongoku.yaml)
        if (!isOngokuProject(projectDir)) {
          console.log(chalk.blue('To pull changes, you must be in an Ongoku project directory or specify one with --directory.'));
          return null;
        }
        
        // Verify it's a git repository
        const { git, isRepo } = await verifyGitRepository(projectDir);
        if (!isRepo) return null;
        
        // 2. Check for uncommitted changes
        const status = await git.getStatus();
        if (!status.isClean() && !options.force) {
          console.log(chalk.yellow('You have local uncommitted changes that might be overwritten.'));
          console.log('Modified files:', status.modified.join(', '));
          
          const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to proceed with pull anyway?',
            default: false
          }]);
          
          if (!proceed) {
            console.log(chalk.blue('Pull canceled. Commit or stash your changes first.'));
            return null;
          }
        }
        
        // 3. Get project identifiers
        const { projectName, remoteUrl } = await getProjectIdentifiers(projectDir, git, spinner);
        
        // 4. Find the project
        const api = new ApiClient();
        const project = await findProject(api, projectName, remoteUrl, spinner);
        if (!project) return null;
        
        spinner.succeed(chalk.green(`Found project: ${project.name}`));
        
        // 5. Get Git credentials
        const gitCredentials = await getGitCredentials(api, project.id, spinner, git);
        if (!gitCredentials) return null;
        
        // If we're using cached credentials, we can skip the configuration
        if (gitCredentials.reused) {
          spinner.succeed(chalk.green('Using existing Git credentials'));
        } else {
          const { token, repo_url, expires_at } = gitCredentials.git_info;
          spinner.succeed(chalk.green('Git credentials generated successfully'));
          
          // Configure Git with token
          await git.configureWithToken(token, repo_url, expires_at);
        }
        
        spinner.text = 'Pulling latest changes...';
        const pullSuccess = await git.pull();
        
        if (pullSuccess) {
          spinner.succeed(chalk.green('Successfully pulled latest changes.'));
          
          // 7. Check for schema updates
          const schemaDir = path.join(projectDir, 'goku_schema');
          if (fs.existsSync(schemaDir)) {
            const schemaFiles = fs.readdirSync(schemaDir)
              .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
            
            if (schemaFiles.length > 0) {
              console.log(chalk.blue('\nSchema files found:'));
              for (const file of schemaFiles) {
                const filePath = path.join(schemaDir, file);
                const stats = fs.statSync(filePath);
                const modified = new Date(stats.mtime).toLocaleString();
                console.log(`  - ${file} (Last modified: ${modified})`);
              }
              
              console.log(chalk.blue('\nTip: You can modify these schema files and use `ongoku push --schema-only` to update your project.'));
            }
          } else {
            console.log(chalk.yellow('\nNo schema directory found. You may want to create one:'));
            console.log(chalk.white(`mkdir -p ${path.join(projectDir, 'goku_schema')}`));
          }
          
        } else {
          spinner.fail(chalk.red('Failed to pull changes.'));
          console.log(chalk.yellow('\nTroubleshooting tips:'));
          console.log('1. Check if you have access to the repository');
          console.log('2. Try running `git pull origin main` manually to see detailed errors');
          console.log('3. Ensure your local changes are committed or stashed');
        }
        
        return pullSuccess;
      }, 'Pull failed', 'Preparing to pull changes...');
    });
}
