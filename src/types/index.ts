// File: project-root/src/types/index.ts
// Defines shared TypeScript types for the web application,
// including structures for tasks and potentially for Firestore interaction.

import { Timestamp } from 'firebase/firestore'; // Import Timestamp type for Firestore

/**
 * Represents a single step within an AirdropTask.
 */
export interface TaskStep {
  id: string; // Unique identifier for the step
  title: string;
  description: string; // Optional: Detailed description or instructions for the step
  isCompleted: boolean; // Tracks the completion status of this step
  order: number; // Defines the sequence of the step within the task
}

/**
 * Represents an airdrop task as used within the application logic (with JS Date objects).
 */
export interface AirdropTask {
  id?: string; // Firestore document ID, optional when creating a new task
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
  color?: string; // e.g., Tailwind color class like 'bg-blue-500' or a hex code
  notificationId?: string | null; // ID for notifications (can be string for web push, or null)
  userId: string; // ID of the user who owns this task
  createdAt?: Date; // JavaScript Date object, timestamp of creation
  updatedAt?: Date; // JavaScript Date object, timestamp of last update
}

/**
 * Represents an airdrop task as stored in and retrieved directly from Firestore (with Timestamp objects).
 * This type is useful for type checking data before conversion to AirdropTask with JS Dates.
 */
export interface AirdropTaskFS {
  // id is typically the document ID and not part of the document data itself.
  name: string;
  description: string;
  interval: 'hourly' | 'daily' | 'weekly' | 'biweekly';
  steps: TaskStep[]; // Assuming steps are stored directly as an array of objects
  streak: number;
  lastCompleted: Timestamp | null; // Firestore Timestamp or null
  nextDue: Timestamp; // Firestore Timestamp
  isActive: boolean;
  category: string;
  priority: 'low' | 'medium' | 'high';
  color?: string;
  notificationId?: string | null; // Consistent with AirdropTask
  userId: string;
  createdAt: Timestamp; // Firestore Timestamp for creation
  updatedAt: Timestamp; // Firestore Timestamp for last update
}

// Other shared types can be added here.
