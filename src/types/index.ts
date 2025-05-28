// File: project-root/src/types/index.ts
// Assuming firebase is global for Timestamp in single HTML setup
// declare var firebase: any; 

export interface TaskStep {
  id: string; title: string; description: string; isCompleted: boolean; order: number;
}
export interface AirdropTask {
  id?: string; name: string; description: string; interval: 'hourly' | 'daily' | 'weekly' | 'biweekly';
  steps: TaskStep[]; streak: number; lastCompleted: Date | null; nextDue: Date; isActive: boolean;
  category: string; priority: 'low' | 'medium' | 'high'; color?: string; userId: string; 
  createdAt?: Date; updatedAt?: Date; 
}
export interface AirdropTaskFS { // Firestore specific with Timestamps
  id?: string; name: string; description: string; interval: 'hourly' | 'daily' | 'weekly' | 'biweekly';
  steps: TaskStep[]; streak: number; lastCompleted: firebase.firestore.Timestamp | null; 
  nextDue: firebase.firestore.Timestamp; isActive: boolean; category: string; 
  priority: 'low' | 'medium' | 'high'; color?: string; userId: string; 
  createdAt: firebase.firestore.Timestamp; updatedAt: firebase.firestore.Timestamp;
}