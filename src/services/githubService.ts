import { sovereignFetch } from '../lib/supabase';

/**
 * Service to communicate with backend.
 */
export const githubService = {
  /**
   * Fetches the central archive registry.
   */
  async fetchRegistry() {
    try {
      console.log('[Backend Service] Fetching registry from /api/data...');
      const response = await sovereignFetch(`/api/data?t=${Date.now()}`);
      
      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(`Failed to fetch archive registry: ${response.status}`);
      }

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Malformed JSON response from server');
      }
    } catch (error) {
      console.error('Service: Fetch failed', error);
      throw error;
    }
  },

  /**
   * Commits the current state of the archive.
   */
  async commitUpdate(data: any, logAction?: string, logTarget?: string) {
    try {
      const response = await sovereignFetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, _logAction: logAction, _logTarget: logTarget })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to commit updates to backend');
      }

      return await response.json();
    } catch (error) {
      console.error('Service: Commit failed', error);
      throw error;
    }
  },

  /**
   * Uploads a file (PDF or Image) to the GitHub archive directory.
   */
  async uploadMedia(file: File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
          const timestampedName = `${Date.now()}_${safeName}`;

          const response = await sovereignFetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: timestampedName,
              fileData: reader.result
            })
          });

          const result = await response.json();
          if (!result.success) throw new Error(result.error);
          
          resolve(result.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
    });
  },

  /**
   * Deletes a file from the GitHub archive directory.
   */
  async deleteMedia(url: string) {
    if (!url) return;
    try {
      const response = await sovereignFetch('/api/deleteMedia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      const result = await response.json();
      if (!result.success && response.status !== 200) {
        console.warn('Failed to delete media:', result.error);
      }
      return result;
    } catch (error) {
      console.error('GitHub Service: Delete media failed', error);
    }
  }
};
