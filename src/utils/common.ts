import { ApiClient } from './api';
import { GitClient } from './git';
import { auth } from '../config/config';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import path from 'path';
import fs from 'fs';

/**
 * Check if the user is authenticated, display message if not
 * @returns boolean indicating authentication status
 */
export async function checkAuthentication(): Promise<boolean> {
  const isAuthenticated = await auth.isAuthenticated();
  if (!isAuthenticated) {
    console.log(chalk.yellow('You are not logged in. Please run `ongoku login` first.'));
    return false;
  }
  return true;
}

/**
 * Determine project directory from options
 * @param directory Optional directory from command options
 * @returns Resolved absolute path
 */
export function resolveProjectDir(directory?: string): string {
  return directory
    ? path.resolve(directory)
    : process.cwd();
}

/**
 * Check if a directory is a valid Ongoku project by looking for ongoku.yaml
 * @param projectDir Project directory path
 * @returns boolean indicating if it's an Ongoku project
 */
export function isOngokuProject(projectDir: string): boolean {
  const ongokuYamlPath = path.join(projectDir, 'ongoku.yaml');
  const isProject = fs.existsSync(ongokuYamlPath);
  
  if (!isProject) {
    console.log(chalk.red(`Directory ${projectDir} is not a valid Ongoku project.`));
    console.log(chalk.yellow('An Ongoku project should contain an ongoku.yaml file at the root.'));
  }
  
  return isProject;
}

/**
 * Verify the directory is a git repository
 * @param projectDir Project directory path
 * @returns Object containing GitClient and boolean success status
 */
export async function verifyGitRepository(projectDir: string): Promise<{ git: GitClient; isRepo: boolean }> {
  const git = new GitClient(projectDir);
  const isRepo = await git.isGitRepository();
  
  if (!isRepo) {
    console.log(chalk.red(`Directory ${projectDir} is not a git repository.`));
    console.log(chalk.blue('Use `ongoku clone <project-name>` to clone a project first.'));
  }
  
  return { git, isRepo };
}

/**
 * Find project schema file
 * @param projectDir Project directory path
 * @returns Path to schema file or empty string if not found
 */
export function findSchemaFile(projectDir: string): string {
  const schemaFiles = [
    path.join(projectDir, 'goku_schema', 'app.schema.yml'),
    path.join(projectDir, 'goku_schema', 'app.schema.yaml'),
    path.join(projectDir, 'goku_schema', 'schema.yml'),
    path.join(projectDir, 'goku_schema', 'schema.yaml'),
    path.join(projectDir, '.goku', 'schema.yml'),
    path.join(projectDir, '.goku', 'schema.yaml')
  ];
  
  for (const file of schemaFiles) {
    if (fs.existsSync(file)) {
      return file;
    }
  }
  
  return '';
}

/**
 * Identify project from directory name or git remote
 * @param projectDir Project directory
 * @param git GitClient instance
 * @param spinner Optional spinner to update
 * @returns Object with project name and remote URL
 */
export async function getProjectIdentifiers(
  projectDir: string,
  git: GitClient,
  spinner?: Ora
): Promise<{ projectName: string; remoteUrl: string }> {
  // Try to get the GitHub URL from git remote
  let remoteUrl = '';
  try {
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find(remote => remote.name === 'origin');
    if (originRemote?.refs?.fetch) {
      remoteUrl = originRemote.refs.fetch;
      if (spinner) spinner.text = `Found remote: ${remoteUrl}`;
    }
  } catch (error) {
    // If we can't get remote info, continue using the directory name
  }

  // Extract project name from directory name
  const projectDirName = path.basename(projectDir);
  let projectName = projectDirName;
  
  // If project name starts with "project-", remove the prefix
  if (projectName.startsWith('project-')) {
    projectName = projectName.substring(8);
  }

  return { projectName, remoteUrl };
}

/**
 * Fetch and identify project from API
 * @param api ApiClient instance
 * @param projectName Project name
 * @param remoteUrl Optional Git remote URL
 * @param spinner Optional spinner to update
 * @returns Project object or null if not found
 */
export async function findProject(
  api: ApiClient,
  projectName: string,
  remoteUrl?: string,
  spinner?: Ora
): Promise<any | null> {
  try {
    if (spinner) spinner.text = 'Fetching projects...';
    const projects = await api.getProjects();
    
    // Find the project using multiple strategies
    let project = null;
    
    // First try by ID if projectName looks like an ID
    if (projectName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      project = projects.find((p: any) => p.id === projectName);
    }
    
    // Then try by GitHub URL if available
    if (!project && remoteUrl) {
      project = projects.find((p: any) => 
        p.github_repo_url && remoteUrl.includes(p.github_repo_url.split('github.com/')[1]));
    }
    
    // Finally try by name (case insensitive)
    if (!project) {
      project = projects.find((p: any) => 
        p.name.toLowerCase() === projectName.toLowerCase());
    }
    
    if (!project && spinner) {
      spinner.fail(chalk.red(`Could not identify the project "${projectName}"`));
      console.log(chalk.blue('Available projects:'));
      projects.forEach((p: any) => {
        console.log(`  - ${p.name} (${p.id})${p.github_repo_url ? ` - ${p.github_repo_url}` : ''}`);
      });
    }
    
    return project;
  } catch (error: any) {
    if (spinner) spinner.fail(chalk.red('Failed to fetch projects:'));
    console.error(error.message);
    console.log(chalk.blue('Ensure the API URL is correct with: `ongoku config get apiUrl`'));
    return null;
  }
}

/**
 * Generate Git credentials for a project
 * @param api ApiClient instance
 * @param projectId Project ID
 * @param spinner Optional spinner to update
 * @param git Optional GitClient instance to check existing token validity
 * @returns Git credentials object or null if failed
 */
export async function getGitCredentials(
  api: ApiClient,
  projectId: string,
  spinner?: Ora,
  git?: GitClient
): Promise<any | null> {
  try {
    // If we have a GitClient and it has a valid token, skip fetching new credentials
    if (git && git.isTokenValid()) {
      if (spinner) spinner.text = 'Using existing Git credentials...';  
      return { success: true, valid: true, reused: true };
    }
    
    if (spinner) spinner.text = 'Generating Git credentials...';
    const tokenResponse = await api.getGitToken(projectId);
    
    if (!tokenResponse.success || !tokenResponse.git_info) {
      if (spinner) spinner.fail(chalk.red('Failed to generate Git credentials.'));
      console.error('API Response:', JSON.stringify(tokenResponse));
      return null;
    }
    
    return tokenResponse.git_info;
  } catch (error: any) {
    if (spinner) spinner.fail(chalk.red('Failed to generate Git credentials:'));
    console.error(error.message);
    return null;
  }
}

/**
 * Run a function with proper error handling and spinner management
 * @param fn Async function to run
 * @param errorMessage Message to show on error
 * @param initialSpinnerText Initial spinner text
 * @returns Promise that resolves to the function result or null on error
 */
export async function withErrorHandling<T>(
  fn: (spinner: Ora) => Promise<T>,
  errorMessage: string,
  initialSpinnerText?: string
): Promise<T | null> {
  const spinner = ora(initialSpinnerText).start();
  try {
    return await fn(spinner);
  } catch (error: any) {
    spinner.fail(chalk.red(errorMessage));
    console.error(error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    return null;
  } finally {
    if (spinner.isSpinning) spinner.stop();
  }
}
