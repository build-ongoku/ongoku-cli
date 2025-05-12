import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { ApiClient } from '../utils/api';
import { GitClient } from '../utils/git';
import {
  checkAuthentication,
  resolveProjectDir,
  findProject,
  getGitCredentials,
  withErrorHandling
} from '../utils/common';

export function cloneCommand(program: Command): void {
  program
    .command('clone <project-name>')
    .description('Clone an Ongoku project to your local machine')
    .option('-d, --directory <directory>', 'Target directory (defaults to current directory)')
    .option('-f, --force', 'Force clone even if directory is not empty')
    .action(async (projectName, options) => {
      // Check authentication first
      if (!await checkAuthentication()) return;

      await withErrorHandling(async (spinner) => {
        // 1. Determine target directory
        const targetDir = options.directory 
          ? path.resolve(options.directory) 
          : path.resolve(process.cwd(), projectName);
        
        // 2. Check if directory exists and is not empty
        if (fs.existsSync(targetDir)) {
          const dirContents = fs.readdirSync(targetDir);
          if (dirContents.length > 0 && !options.force) {
            const { overwrite } = await inquirer.prompt([{
              type: 'confirm',
              name: 'overwrite',
              message: `Directory ${targetDir} is not empty. Continue anyway?`,
              default: false
            }]);
            
            if (!overwrite) {
              console.log(chalk.yellow('Clone canceled.'));
              return null;
            }
          }
        } else {
          // Create directory if it doesn't exist
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // 3. Find the project
        const api = new ApiClient();
        spinner.text = 'Fetching project information...';
        const project = await findProject(api, projectName, undefined, spinner);
        if (!project) return null;
        
        // 4. Check project status
        if (project.status !== 'initialized' && project.status !== 'active') {
          spinner.fail(chalk.yellow(`Project "${projectName}" is not ready yet (status: ${project.status}).`));
          console.log(chalk.blue('Please wait for the project initialization to complete.'));
          return null;
        }
        
        if (!project.github_repo_url) {
          spinner.fail(chalk.yellow(`Project "${projectName}" doesn't have a GitHub repository.`));
          console.log(chalk.blue('Please check the project status in the web dashboard.'));
          return null;
        }
        
        // 5. Get Git credentials
        const gitCredentials = await getGitCredentials(api, project.id, spinner);
        if (!gitCredentials) return null;
        
        const { auth_url, repo_url } = gitCredentials;
        
        // 6. Clone the repository
        spinner.text = `Cloning repository from ${repo_url}...`;
        const git = new GitClient(targetDir);
        const cloneSuccess = await git.clone(auth_url, targetDir);
        
        if (!cloneSuccess) {
          spinner.fail(chalk.red('Failed to clone repository.'));
          return null;
        }
        
        spinner.succeed(chalk.green(`Project "${projectName}" cloned successfully to ${targetDir}`));
        
        // 7. Check for schema directory
        const schemaDir = path.join(targetDir, 'goku_schema');
        if (!fs.existsSync(schemaDir)) {
          console.log(chalk.yellow('\nNote: This project does not have a schema directory yet.'));
          console.log(chalk.blue('You can create one with:'), chalk.white(`mkdir -p ${path.join(path.relative(process.cwd(), targetDir), 'goku_schema')}`));
        }
        
        // 8. Provide helpful next steps
        console.log('\nNext steps:');
        console.log(chalk.blue(`1. Navigate to the project:`), chalk.white(`cd ${path.relative(process.cwd(), targetDir)}`));
        console.log(chalk.blue(`2. Make changes to your project files`));
        console.log(chalk.blue(`3. Push your changes:`), chalk.white('ongoku push'));
        
        return true;
      }, 'Clone failed', 'Preparing to clone project...');
    });
}
