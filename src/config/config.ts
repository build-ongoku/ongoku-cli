import Conf from 'conf';
import os from 'os';
import path from 'path';
import keytar from 'keytar';

// Default API URL - can be overridden by environment variable
export const DEFAULT_API_URL = process.env.ONGOKU_API_URL || 'http://ongoku.com/api/cli';

// Define configuration schema
interface ConfigSchema {
  apiUrl: string;
  lastUpdateCheck?: number;
  userId?: string;
  lastSync?: string;
}

// Create config instance
export const config = new Conf<ConfigSchema>({
  projectName: 'ongoku-cli',
  defaults: {
    apiUrl: DEFAULT_API_URL,
  }
});

// Ensure the API URL is set to our default if not explicitly configured
if (!config.has('apiUrl')) {
  config.set('apiUrl', DEFAULT_API_URL);
}

// Service name for keytar
const SERVICE_NAME = 'ongoku-cli';
const ACCOUNT_NAME = 'default';

// Auth token handling (secure storage)
export const auth = {
  /**
   * Store the auth token securely in the system keychain
   */
  async setToken(token: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
      // Store the userId in the config (not sensitive)
      const [tokenPart] = token.split('.');
      // This is just a base hash identifier, not the actual token
      config.set('userId', tokenPart.substring(0, 8));
    } catch (error) {
      console.error('Error storing auth token:', error);
      throw new Error('Failed to securely store authentication token');
    }
  },

  /**
   * Get the auth token from the system keychain
   */
  async getToken(): Promise<string | null> {
    try {
      return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch (error) {
      console.error('Error retrieving auth token:', error);
      return null;
    }
  },

  /**
   * Delete the auth token from the system keychain
   */
  async deleteToken(): Promise<boolean> {
    try {
      const result = await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      if (result) {
        config.delete('userId');
      }
      return result;
    } catch (error) {
      console.error('Error deleting auth token:', error);
      return false;
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
};

// Project data caching
const CACHE_DIR = path.join(os.homedir(), '.ongoku', 'cache');

export const cacheDir = CACHE_DIR;
