// File: src/utils/firestoreHelper.ts
// Description: Contains shared constants and utility functions for Firestore interactions in the web app.

// Firestore Path Constants
export const TASKS_COLLECTION_BASE_PATH = 'artifacts';
export const APP_ID_PLACEHOLDER = 'crypto-airdrop-manager'; // Standardized placeholder
export const UNIFIED_TASKS_COLLECTION_NAME = 'airdropTasks'; // Standardized collection name

/**
 * Generates the Firestore collection path for a user's tasks.
 * @param userId The ID of the current user.
 * @param current_app_id Optional: The current app ID, if provided globally (e.g., __app_id).
 * @returns The full Firestore path string for the user's tasks collection, or null if userId is not provided.
 */
export const getWebTasksCollectionPathForUser = (userId: string | null, current_app_id?: string): string | null => {
  if (!userId) {
    console.warn("getWebTasksCollectionPathForUser: userId is null, cannot generate path.");
    return null;
  }
  // Use the globally defined __app_id if available, otherwise use the placeholder.
  // This logic is similar to what's in App.tsx for defining `appId`.
  const appIdToUse = current_app_id || (typeof __app_id !== 'undefined' ? __app_id : APP_ID_PLACEHOLDER);
  
  return `${TASKS_COLLECTION_BASE_PATH}/${appIdToUse}/users/${userId}/${UNIFIED_TASKS_COLLECTION_NAME}`;
};
