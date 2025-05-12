import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { ApiClient } from '../utils/api';
import { 
  checkAuthentication,
  resolveProjectDir,
  verifyGitRepository,
  findSchemaFile,
  getProjectIdentifiers,
  findProject,
  getGitCredentials,
  withErrorHandling,
  isOngokuProject
} from '../utils/common';

export function pushCommand(program: Command): void {
  program
    .command('push')
    .description('Push local changes to your Ongoku project')
    .option('-m, --message <message>', 'Commit message', 'Update from Ongoku CLI')
    .option('-d, --directory <directory>', 'Project directory (defaults to current directory)')
    .option('-s, --schema-only', 'Only push schema updates without code changes')
    .option('-c, --code-only', 'Only push code changes without schema updates')
    .action(async (options) => {
      // Check authentication first
      if (!await checkAuthentication()) return;

      await withErrorHandling(async (spinner) => {
        // 1. Setup and validation
        const projectDir = resolveProjectDir(options.directory);
        
        // Verify this is an Ongoku project (has ongoku.yaml)
        if (!isOngokuProject(projectDir)) {
          console.log(chalk.blue('To push changes, you must be in an Ongoku project directory or specify one with --directory.'));
          return null;
        }
        
        // Verify it's a git repository
        const { git, isRepo } = await verifyGitRepository(projectDir);
        if (!isRepo) return null;
        
        // 2. Find schema file
        const schemaPath = findSchemaFile(projectDir);
        if (!schemaPath && !options.codeOnly) {
          console.log(chalk.yellow('Could not find a schema file in the project.'));
          console.log(chalk.blue('Will only push code changes without updating the schema.'));
          
          if (options.schemaOnly) {
            console.log(chalk.red('Cannot push schema: No schema file found.'));
            console.log(chalk.blue('Create a schema file in the goku_schema directory first.'));
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
        
        // 5. Push schema if available and not in code-only mode
        if (schemaPath && !options.codeOnly) {
          spinner.text = 'Updating schema...';
          try {
            // Read and parse the schema file
            const schemaContent = fs.readFileSync(schemaPath, 'utf8');
            let schema;
            
            try {
              // Try to parse as YAML
              schema = yaml.load(schemaContent);
            } catch (yamlError) {
              // If YAML parsing fails, check if it might be JSON
              try {
                schema = JSON.parse(schemaContent);
              } catch (jsonError) {
                throw new Error('Schema file is neither valid YAML nor JSON');
              }
            }
            
            // Push schema to API
            // Tell the server to skip Git commit since we'll do it from CLI
            const skipGitCommit = !options.schemaOnly; // Only skip if we're going to commit locally
            const result = await api.pushProjectUpdates(project.id, schema, skipGitCommit);
            spinner.succeed(chalk.green('Schema updated successfully'));
            
            if (result.warning) {
              console.log(chalk.yellow(`Warning: ${result.warning}`));
            }
            
          } catch (error: any) {
            spinner.fail(chalk.red(`Failed to update schema: ${error.message}`));
            if (options.schemaOnly) {
              return null; // Exit if only pushing schema and it failed
            }
            console.log(chalk.blue('Will continue with code changes.'));
          }
        }
        
        // Stop here if schema-only mode
        if (options.schemaOnly) {
          return null;
        }
        
        // 6. Get Git credentials
        const gitCredentials = await getGitCredentials(api, project.id, spinner, git);
        if (!gitCredentials) return null;
        
        // If we're using cached credentials, we can skip the configuration
        if (gitCredentials.reused) {
          spinner.succeed(chalk.green('Using existing Git credentials'));
        } else {
          const { token, repo_url, expires_at } = gitCredentials.git_info;
          spinner.succeed(chalk.green('Git credentials generated successfully'));
          
          // 7. Configure Git with token
          await git.configureWithToken(token, repo_url, expires_at);
        }
        
        // Check for changes
        spinner.text = 'Checking for changes...'; 
        const status = await git.getStatus();
        
        if (status.isClean()) {
          spinner.info(chalk.blue('No changes to commit'));
          return null;
        }
        
        // 9. Show what's being changed
        console.log(chalk.blue('\nChanges to be pushed:'));
        if (status.created.length > 0) {
          console.log('  New files:', status.created.join(', '));
        }
        if (status.modified.length > 0) {
          console.log('  Modified:', status.modified.join(', '));
        }
        if (status.deleted.length > 0) {
          console.log('  Deleted:', status.deleted.join(', '));
        }
        
        // 10. Commit and push changes
        spinner.text = 'Pushing code changes...';
        const commitMessage = options.message || 'Update from Ongoku CLI';
        const pushSuccess = await git.commitAndPush(commitMessage);
        
        if (pushSuccess) {
          spinner.succeed(chalk.green('Successfully pushed changes to Ongoku.'));
        } else {
          spinner.fail(chalk.red('Failed to push changes.'));
        }
        
        return true;
      }, 'Push failed', 'Preparing to push changes...');
    });
}
