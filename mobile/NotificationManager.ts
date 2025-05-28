// File: project-root/mobile/NotificationManager.ts
import PushNotification from 'react-native-push-notification';
import type { AirdropTask } from './types'; // Assuming AirdropTask is in types.ts

const NOTIFICATION_CHANNEL_ID = "airdrop-task-reminders"; // Must match App.tsx and SettingsScreen.tsx

/**
 * Generates a unique numeric ID for a notification based on the task ID.
 * Simple hash function, ensure it's unique enough for your needs or use a more robust UUID.
 * react-native-push-notification requires notification IDs to be numbers for some functions.
 */
const generateNumericNotificationId = (taskId: string): number => {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Ensure positive and within a reasonable range if necessary, though usually not an issue.
  return Math.abs(hash % 2147483647); // Max 32-bit signed integer
};


/**
 * Schedules a local notification for a given task.
 * @param task The AirdropTask object.
 * @param fireDate The Date object when the notification should fire.
 * @param appSettings The current application settings, specifically to check enableNotifications.
 */
export const scheduleNotification = (
    task: AirdropTask,
    fireDate: Date,
    enableNotificationsSetting: boolean
) => {
  if (!enableNotificationsSetting) {
    console.log(`NotificationManager: Notifications are disabled in settings. Skipping schedule for task: ${task.name}`);
    return null; // Return null if not scheduled
  }

  if (fireDate.getTime() <= Date.now()) {
    console.log(`NotificationManager: Fire date for task "${task.name}" is in the past. Skipping notification.`);
    return null;
  }

  const notificationId = generateNumericNotificationId(task.id);

  PushNotification.localNotificationSchedule({
    channelId: NOTIFICATION_CHANNEL_ID,
    id: notificationId, // Unique ID for this notification
    title: `Task Due: ${task.name}`,
    message: `Your airdrop task "${task.name}" is due now! Category: ${task.category}. Priority: ${task.priority}.`,
    date: fireDate,
    allowWhileIdle: true, // (optional) set notification to work while on doze, default: false
    playSound: true,
    soundName: "default",
    vibrate: true,
    vibration: 300, // Vibration length in milliseconds
    // userInfo: { taskId: task.id }, // Optional: To identify task when notification is opened
    // actions: ['View Task', 'Snooze'], // Example actions
    // repeatType: undefined, // 'week', 'day', 'hour', 'minute', 'time' - not using for individual tasks
    // repeatTime: undefined, 
    invokeApp: true, // Whether to open the app on notification tap
  });

  console.log(`NotificationManager: Scheduled notification for task "${task.name}" (ID: ${notificationId}) at ${fireDate.toLocaleString()}`);
  return notificationId; // Return the ID used for scheduling
};

/**
 * Cancels a specific scheduled local notification by its numeric ID.
 * @param notificationId The numeric ID of the notification to cancel.
 */
export const cancelNotificationById = (notificationId: number | string) => { // ID can be string from older versions
  const numericId = typeof notificationId === 'string' ? parseInt(notificationId, 10) : notificationId;
  if (isNaN(numericId)) {
      console.warn(`NotificationManager: Invalid notificationId for cancellation: ${notificationId}`);
      return;
  }
  PushNotification.cancelLocalNotification(numericId.toString()); // API expects string ID
  console.log(`NotificationManager: Attempted to cancel notification with ID: ${numericId}`);
};


/**
 * Cancels a scheduled notification for a given task ID.
 * @param taskId The ID of the task whose notification should be cancelled.
 */
export const cancelTaskNotification = (taskId: string) => {
    if (!taskId) return;
    const notificationId = generateNumericNotificationId(taskId);
    cancelNotificationById(notificationId);
};


/**
 * Cancels all scheduled local notifications for the app.
 */
export const cancelAllNotifications = () => {
  PushNotification.cancelAllLocalNotifications();
  console.log("NotificationManager: All scheduled notifications cancelled.");
};

// You might add functions here to update notifications if task details change significantly.
// For now, the approach is to cancel and reschedule.

export { generateNumericNotificationId };
