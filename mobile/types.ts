// File: project-root/mobile/types.ts
// Description: Defines shared TypeScript types for the mobile application,
// including structures for tasks and navigation parameters.

import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'; // Import Timestamp type

/**
 * Represents a single step within an AirdropTask.
 */
export interface TaskStep {
  id: string;
  title: string;
  description: string; // Optional: Detailed description or instructions for the step
  isCompleted: boolean; // Tracks the completion status of this step
  order: number; // Defines the sequence of the step within the task
}

/**
 * Represents an airdrop task as used within the application logic (with JS Date objects).
 */
export interface AirdropTask {
  id: string; // Unique identifier for the task, usually Firestore document ID
  name: string;
  description: string;
  interval: 'hourly' | 'daily' | 'weekly' | 'biweekly';
  steps: TaskStep[];
  streak: number;
  lastCompleted: Date | null; // JavaScript Date object or null
  nextDue: Date; // JavaScript Date object
  isActive: boolean;
  category: string;
  priority: 'low' | 'medium' | 'high';
  color: string; // Tailwind-like class or hex color
  notificationId?: number | null; // Numeric ID for local notifications, or null if none
  userId?: string; // ID of the user who owns this task
  createdAt?: Date; // JavaScript Date object
  updatedAt?: Date; // JavaScript Date object
}

/**
 * Represents an airdrop task as stored in and retrieved directly from Firestore (with Timestamp objects).
 * This type is useful for type checking data before conversion to AirdropTask with JS Dates.
 */
export interface AirdropTaskFirestore {
  // id is typically the document ID and not part of the document data itself, but can be included after fetching.
  name: string;
  description: string;
  interval: 'hourly' | 'daily' | 'weekly' | 'biweekly';
  steps: TaskStep[];
  streak: number;
  lastCompleted: FirebaseFirestoreTypes.Timestamp | null; // Firestore Timestamp or null
  nextDue: FirebaseFirestoreTypes.Timestamp; // Firestore Timestamp
  isActive: boolean;
  category: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
  notificationId?: number | null;
  userId?: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp; // Firestore Timestamp for creation
  updatedAt?: FirebaseFirestoreTypes.Timestamp; // Firestore Timestamp for last update
}


/**
 * Defines the parameters for each screen in the navigation stack.
 * This is used by React Navigation for type checking routes and parameters.
 */
export type RootStackParamList = {
  Auth: undefined; // Authentication screen
  TaskList: { 
    // Parameters passed to TaskList, e.g., after an operation in another screen
    updatedTask?: AirdropTask; // If a task was updated
    completedTaskId?: string; // ID of a task that was just completed
    newTask?: AirdropTask; // If a new task was added
    deletedTaskId?: string; // ID of a task that was deleted
    refresh?: boolean; // General flag to trigger a refresh if needed
  } | undefined; // Undefined means no params are passed
  TaskDetail: { 
    taskId: string; 
    taskName: string; // To display in header while task data might be loading
  };
  AddTask: { 
    taskIdToEdit?: string; // If present, screen is in edit mode for this task
  } | undefined;
  Settings: undefined; // Settings screen takes no parameters
};
