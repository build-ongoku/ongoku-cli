import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { ApiClient } from '../utils/api';
import {
  checkAuthentication,
  resolveProjectDir,
  isOngokuProject,
  findProject,
  withErrorHandling
} from '../utils/common';

interface OngokuConfig {
  name?: string;
  app_name?: string; // Some projects use app_name instead of name
  id?: string;
  projectId?: string;
  description?: string;
  version?: string;
  apiVersion?: string;
  environment?: string;
  config?: {
    [key: string]: any;
  };
  dependencies?: {
    [key: string]: string;
  };
  [key: string]: any; // Allow for additional properties
}

export function projectCommand(program: Command): void {
  program
    .command('project')
    .description('Display information about the current Ongoku project')
    .option('-d, --directory <directory>', 'Project directory (defaults to current directory)')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options) => {
      await withErrorHandling(
        async (spinner) => {
          spinner.start('Loading project details...');
          
          // 1. Setup and validation
          const projectDir = resolveProjectDir(options.directory);
          
          // Verify this is an Ongoku project
          if (!isOngokuProject(projectDir)) {
            console.log(chalk.blue('To view project details, you must be in an Ongoku project directory or specify one with --directory.'));
            return null;
          }
          
          // 2. Read the ongoku.yaml file
          const ongokuYamlPath = path.join(projectDir, 'ongoku.yaml');
          const ongokuYamlContent = fs.readFileSync(ongokuYamlPath, 'utf8');
          const config = yaml.load(ongokuYamlContent) as OngokuConfig;
          
          // 3. Get additional project info from API if available
          let apiProjectInfo = null;
          const isAuthenticated = await checkAuthentication();
          
          if (isAuthenticated && (config.id || config.projectId)) {
            spinner.text = 'Fetching project details from API...';
            try {
              const projectId = config.id || config.projectId;
              const apiClient = new ApiClient();
              const projects = await apiClient.getProjects();
              apiProjectInfo = projects.find((p: any) => p.id === projectId || p.name === config.name);
            } catch (error) {
              // Continue without API info if there's an error
              console.log(chalk.yellow('Could not fetch project details from API, showing local information only.'));
            }
          }
          
          spinner.stop();
          
          // 4. Display the project information
          if (options.json) {
            // JSON output
            const output = {
              ...config,
              projectDir,
              apiInfo: apiProjectInfo || undefined
            };
            console.log(JSON.stringify(output, null, 2));
          } else {
            // Pretty-printed output
            console.log();
            console.log(chalk.bold('📁 Project Information:'));
            // Use app_name if name isn't available
            const projectName = config.name || config.app_name || 'Unknown';
            console.log(`${chalk.blue('Project Name:')} ${projectName}`);
            if (config.description) console.log(`${chalk.blue('Description:')} ${config.description}`);
            if (config.id || config.projectId) console.log(`${chalk.blue('Project ID:')} ${config.id || config.projectId}`);
            if (config.version) console.log(`${chalk.blue('Version:')} ${config.version}`);
            console.log(`${chalk.blue('Directory:')} ${projectDir}`);
            
            if (config.environment) console.log(`${chalk.blue('Environment:')} ${config.environment}`);
            
            if (config.dependencies && Object.keys(config.dependencies).length > 0) {
              console.log();
              console.log(chalk.bold('📦 Dependencies:'));
              Object.entries(config.dependencies).forEach(([name, version]) => {
                console.log(`  ${chalk.gray('•')} ${name}: ${version}`);
              });
            }
            
            if (config.config && Object.keys(config.config).length > 0) {
              console.log();
              console.log(chalk.bold('⚙️  Configuration:'));
              Object.entries(config.config).forEach(([key, value]) => {
                console.log(`  ${chalk.gray('•')} ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
              });
            }
            
            // Display API information if available
            if (apiProjectInfo) {
              console.log();
              console.log(chalk.bold('🌐 API Information:'));
              console.log(`${chalk.blue('Last Updated:')} ${new Date(apiProjectInfo.updatedAt).toLocaleString()}`);
              console.log(`${chalk.blue('Created At:')} ${new Date(apiProjectInfo.createdAt).toLocaleString()}`);
              if (apiProjectInfo.repositoryUrl) {
                console.log(`${chalk.blue('Repository URL:')} ${apiProjectInfo.repositoryUrl}`);
              }
            }
            
            // Git info if available
            try {
              const gitDir = path.join(projectDir, '.git');
              if (fs.existsSync(gitDir)) {
                const isGitRepo = fs.existsSync(gitDir);
                console.log();
                console.log(chalk.bold('🔄 Git Information:'));
                console.log(`${chalk.blue('Git Repository:')} ${isGitRepo ? 'Yes' : 'No'}`);
                
                // You could add more git info here using the git client
              }
            } catch (error) {
              // Ignore git errors
            }
          }
          
          return config;
        },
        'Failed to load project details',
        'Analyzing project information...'
      );
    });
}
