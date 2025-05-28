// File: project-root/mobile/types.ts

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
 * Represents an airdrop task to be tracked by the user.
 */
export interface AirdropTask {
  id: string; // Unique identifier for the task
  name: string; // Name of the airdrop or task
  description: string; // Detailed description of the task, including links or notes
  interval: 'hourly' | 'daily' | 'weekly' | 'biweekly'; // How often the task should be done
  steps: TaskStep[]; // A list of individual steps to complete the task
  streak: number; // Current completion streak for the task
  lastCompleted: Date | null; // The date when the task was last marked as complete
  nextDue: Date; // The date when the task is next due
  isActive: boolean; // Whether the task is currently active or paused
  category: string; // User-defined category for the task (e.g., DeFi, NFT, Gaming)
  priority: 'low' | 'medium' | 'high'; // Priority level of the task
  color: string; // A color code (e.g., hex or a predefined key like 'bg-blue-500') for UI theming
  notificationId?: number; // Optional: Stores the ID of the scheduled local notification
  // userId?: string; // Optional: If tasks are to be synced with a backend and associated with a user
  // createdAt?: Date; // Optional: Timestamp for when the task was created
  // updatedAt?: Date; // Optional: Timestamp for when the task was last updated
}

/**
 * Defines the parameters for each screen in the navigation stack.
 * This is used by React Navigation for type checking routes and parameters.
 */
export type RootStackParamList = {
  TaskList: { updatedTask?: AirdropTask, completedTaskId?: string, newTask?: AirdropTask, deletedTaskId?: string, refresh?: boolean } | undefined; // Added deletedTaskId
  TaskDetail: { taskId: string; taskName: string };
  AddTask: { taskIdToEdit?: string } | undefined;
  Settings: undefined;
};
