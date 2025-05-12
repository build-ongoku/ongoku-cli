import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export class GitClient {
  private git: SimpleGit;
  private projectDir: string;
  private tokenExpiry: number | null = null;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.git = simpleGit(projectDir);
  }
  
  /**
   * Get Git remote information
   * @param verbose If true, includes refs
   */
  async getRemotes(verbose: boolean = false): Promise<any[]> {
    try {
      if (verbose === true) {
        return await this.git.getRemotes(true);
      } else {
        return await this.git.getRemotes(false);
      }
    } catch (error) {
      console.error('Error getting Git remotes:', error);
      return [];
    }
  }
  
  /**
   * Get Git repository status
   */
  async getStatus(): Promise<any> {
    try {
      return await this.git.status();
    } catch (error) {
      console.error('Error getting Git status:', error);
      throw error;
    }
  }

  /**
   * Initialize a new repository
   */
  async init(): Promise<boolean> {
    try {
      // Check if directory already contains a git repository
      const isRepo = await this.isGitRepository();
      if (isRepo) {
        return true; // Already initialized
      }

      await this.git.init();
      return true;
    } catch (error) {
      console.error('Error initializing git repository:', error);
      return false;
    }
  }

  /**
   * Check if the current directory is a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      // If .git directory exists, it's a git repo
      return fs.existsSync(path.join(this.projectDir, '.git'));
    } catch (error) {
      return false;
    }
  }

  /**
   * Clone a repository
   */
  async clone(repoUrl: string, destination: string): Promise<boolean> {
    const spinner = ora('Cloning repository...').start();
    
    try {
      await simpleGit().clone(repoUrl, destination);
      spinner.succeed(chalk.green('Repository cloned successfully'));
      return true;
    } catch (error) {
      spinner.fail(chalk.red('Failed to clone repository'));
      console.error('Error details:', error);
      return false;
    }
  }

  /**
   * Pull latest changes
   */
  async pull(): Promise<boolean> {
    const spinner = ora('Pulling latest changes...').start();
    
    try {
      // Make sure we're in a git repository
      if (!await this.isGitRepository()) {
        spinner.fail(chalk.red('Not a git repository'));
        return false;
      }

      // Always use merge strategy (not rebase)
      await this.git.pull(['--no-rebase']);
      spinner.succeed(chalk.green('Latest changes pulled successfully'));
      return true;
    } catch (error) {
      spinner.fail(chalk.red('Failed to pull changes'));
      console.error('Error details:', error);
      return false;
    }
  }

  /**
   * Commit and push changes
   */
  async commitAndPush(message: string): Promise<boolean> {
    const spinner = ora('Committing and pushing changes...').start();
    
    try {
      // Make sure we're in a git repository
      if (!await this.isGitRepository()) {
        spinner.fail(chalk.red('Not a git repository'));
        return false;
      }

      // Check for changes
      const status = await this.git.status();
      
      if (status.isClean()) {
        spinner.info(chalk.blue('No changes to commit'));
        return true;
      }

      // Add, commit, and push
      await this.git.add('.');
      // Use raw command to bypass GPG signing
      await this.git.raw(['commit', '-m', message, '--no-gpg-sign']);
      
      try {
        // Try to push first
        await this.git.push();
      } catch (pushError) {
        // If push fails, try to pull and then push again
        console.log(chalk.yellow('Push failed, trying to pull changes first...'));
        try {
          // First, stash changes to avoid conflicts
          await this.git.stash();
          
          // Pull the latest changes
          await this.git.pull(['--ff-only']);
          
          // Apply stashed changes and recommit
          await this.git.stash(['pop']);
          
          // Add the files again
          await this.git.add('.');
          
          // Commit changes (will create a new commit on top of pulled changes)
          await this.git.raw(['commit', '-m', 'Update from Ongoku CLI', '--no-gpg-sign']);
          
          // Try pushing again
          await this.git.push();
        } catch (pullError) {
          // If something goes wrong, try to recover stashed changes
          try {
            await this.git.stash(['pop']);
          } catch (stashError) {
            // Ignore stash errors - may not have stashed anything
          }
          // Throw the original push error
          throw pushError;
        }
      }
      
      spinner.succeed(chalk.green('Changes committed and pushed successfully'));
      return true;
    } catch (error) {
      spinner.fail(chalk.red('Failed to commit and push changes'));
      console.error('Error details:', error);
      return false;
    }
  }

  /**
   * Configure Git with token authentication
   * @param token GitHub PAT token
   * @param repoUrl Repository URL
   * @param expiresAt Optional timestamp when the token expires
   */
  async configureWithToken(token: string, repoUrl: string, expiresAt?: number): Promise<boolean> {
    try {
      // Extract the repository owner and name from the URL
      // Example: https://github.com/build-ongoku/project-example
      const urlParts = repoUrl.split('/');
      const repoOwner = urlParts[urlParts.length - 2];
      const repoName = urlParts[urlParts.length - 1];
      
      // Create auth URL with token
      const authUrl = repoUrl.replace('https://', `https://${token}@`);
      
      // Set the remote URL with authentication
      await this.git.remote(['set-url', 'origin', authUrl]);
      
      // Configure Git to not store credentials in plaintext
      await this.git.addConfig('credential.helper', 'cache --timeout=3600');
      
      // Store token expiration if provided
      if (expiresAt) {
        this.tokenExpiry = expiresAt;
      } else {
        // Default to 1 hour from now if not specified
        this.tokenExpiry = Date.now() + 3600 * 1000;
      }
      
      // Verify the configuration worked
      const remotes = await this.git.getRemotes(true);
      const originRemote = remotes.find(remote => remote.name === 'origin');
      
      if (!originRemote) {
        console.error('Failed to configure origin remote');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error configuring git with token:', error);
      return false;
    }
  }
  
  /**
   * Check if the stored token is still valid
   * @returns boolean indicating if token is still valid
   */
  isTokenValid(): boolean {
    if (!this.tokenExpiry) return false;
    
    // Add a 5-minute buffer to avoid edge cases
    const bufferMs = 5 * 60 * 1000; 
    return Date.now() < (this.tokenExpiry - bufferMs);
  }
}
