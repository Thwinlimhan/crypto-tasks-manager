// File: project-root/mobile/NotificationManager.ts
// Manages scheduling and cancelling of local push notifications for tasks.
// Updated to include taskId and taskName in notification payload for deep linking.

import PushNotification, { Importance } from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';
import type { AirdropTask } from './types'; // Assuming AirdropTask type is defined

const CHANNEL_ID = 'airdrop-task-reminders';
const CHANNEL_NAME = 'Task Reminders';

// Call this once when your app initializes
export const configureNotifications = () => {
  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: CHANNEL_NAME,
      channelDescription: 'Reminders for upcoming airdrop tasks',
      playSound: true,
      soundName: 'default',
      importance: Importance.HIGH,
      vibrate: true,
    },
    (created) => console.log(`Notification channel '${CHANNEL_ID}' created: ${created}`)
  );

  // Optional: Request permissions for iOS early if needed,
  // though PushNotification.localNotification will also trigger it.
  if (Platform.OS === 'ios') {
    PushNotification.requestPermissions();
  }
};

// Generates a consistent numeric ID from a string ID (e.g., Firestore document ID)
// This is a simple hash function; for more complex scenarios, a more robust hash might be needed.
export const generateNumericNotificationId = (taskId: string): number => {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash % 2147483647); // Ensure positive and within typical integer limits
};


export const scheduleNotification = (
  task: AirdropTask, 
  fireDate: Date,
  reschedule: boolean = false
): number | null => {
  if (!task.id) {
    console.warn("NotificationManager: Task ID is missing, cannot schedule notification for task:", task.name);
    return null;
  }

  const numericId = generateNumericNotificationId(task.id);
  const title = `Reminder: ${task.name}`;
  const message = `Your task "${task.name}" is due soon! Don't miss out.`;

  // Ensure fireDate is in the future
  if (fireDate.getTime() <= Date.now()) {
    console.log(`NotificationManager: Fire date for task "${task.name}" is in the past. Not scheduling.`);
    return task.notificationId || null; // Return existing ID if any, or null
  }
  
  console.log(`NotificationManager: Scheduling notification for task "${task.name}" (ID: ${task.id}, NumericID: ${numericId}) at ${fireDate.toLocaleString()}`);

  if (Platform.OS === 'ios') {
    // For iOS, userInfo is the standard way to pass data.
    // The id for addNotificationRequest is a string.
    PushNotificationIOS.addNotificationRequest({
      id: numericId.toString(), // Use numericId as string for iOS request ID
      title: title,
      body: message,
      category: CHANNEL_ID, // Can be used for iOS specific actions
      fireDate: fireDate,
      repeats: false, // Assuming non-repeating, adjust if needed
      sound: 'default',
      userInfo: { 
        taskId: task.id, 
        taskName: task.name, // Pass taskName for context
        numericNotificationId: numericId, // Store the numeric ID used
        source: 'AirdropTaskManagerApp' // Identify the source
      },
    });
  } else { // Android
    PushNotification.localNotificationSchedule({
      channelId: CHANNEL_ID,
      id: numericId, // Numeric ID for Android
      title: title,
      message: message,
      date: fireDate,
      allowWhileIdle: true,
      playSound: true,
      soundName: 'default',
      vibrate: true,
      vibration: 300,
      // Use 'userInfo' for consistency, react-native-push-notification will handle it.
      // It gets stringified and put into the 'data' field of the Android intent extras.
      userInfo: { 
        taskId: task.id, 
        taskName: task.name,
        numericNotificationId: numericId,
        source: 'AirdropTaskManagerApp'
      }, 
      // repeatType: undefined, // 'day', 'week', 'month', 'year' or undefined for no repeat
    });
  }
  return numericId; // Return the numeric ID used for scheduling
};

export const cancelTaskNotification = (taskId: string | number) => {
  const idToCancel = typeof taskId === 'string' ? generateNumericNotificationId(taskId) : taskId;
  
  console.log(`NotificationManager: Cancelling notification with ID: ${idToCancel}`);
  if (Platform.OS === 'ios') {
    PushNotificationIOS.removePendingNotificationRequests([idToCancel.toString()]);
    // Also try to remove delivered notifications if they might exist with this ID
    PushNotificationIOS.removeDeliveredNotifications([idToCancel.toString()]);
  } else {
    PushNotification.cancelLocalNotification(idToCancel); // For Android, uses numeric ID
  }
};

export const cancelAllNotifications = () => {
  console.log("NotificationManager: Cancelling ALL local notifications.");
  if (Platform.OS === 'ios') {
    PushNotificationIOS.removeAllPendingNotificationRequests();
    PushNotificationIOS.removeAllDeliveredNotifications(); // Clear delivered ones too
  } else {
    PushNotification.cancelAllLocalNotifications();
  }
};
