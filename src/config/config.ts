import Conf from 'conf';
import os from 'os';
import path from 'path';
import keytar from 'keytar';

// Define constants with clear defaults - these can be overridden via CLI commands
const DEFAULTS = {
  API_URL: 'http://localhost:3000/api/cli',
  SERVICE_NAME: 'ongoku-cli',
  ACCOUNT_NAME: 'default'
};

// Define configuration schema for type safety
interface ConfigSchema {
  apiUrl: string;
  lastUpdateCheck?: number;
  userId?: string;
  lastSync?: string;
}

// Create config instance with defaults
export const config = new Conf<ConfigSchema>({
  projectName: 'ongoku-cli',
  defaults: {
    apiUrl: DEFAULTS.API_URL,
  }
});

// Constants for secure storage
const SERVICE_NAME = DEFAULTS.SERVICE_NAME;
const ACCOUNT_NAME = DEFAULTS.ACCOUNT_NAME;

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

// Project data caching - define the default location for cache files
export const cacheDir = path.join(os.homedir(), '.ongoku', 'cache');
