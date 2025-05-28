// App.tsx (Main entry point for the React Native app)
// This file would typically be at the root of your React Native project.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import other necessary components from react-native
import { StatusBar, useColorScheme } from 'react-native';

// Import your screen components
import TaskListScreen from './screens/TaskListScreen'; // Main screen showing tasks
import TaskDetailScreen from './screens/TaskDetailScreen'; // Screen for viewing/completing a task's steps
import AddTaskScreen from './screens/AddTaskScreen'; // Screen/Modal for adding a new task
import SettingsScreen from './screens/SettingsScreen'; // Screen for app settings

// Import data types (can be shared with web/desktop if structured well)
import type { AirdropTask, TaskStep } from './types'; // Assuming types.ts exists

// Define navigation stack parameters
export type RootStackParamList = {
  TaskList: undefined; // No params for TaskList
  TaskDetail: { taskId: string; taskName: string }; // Pass taskId to detail screen
  AddTask: undefined; // Or { taskToEdit?: AirdropTask } for editing
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#111827' : '#F3F4F6', // DarkerGray : LighterGray
    flex: 1,
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={backgroundStyle.backgroundColor} />
        <Stack.Navigator
          initialRouteName="TaskList"
          screenOptions={{
            headerStyle: {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', // DarkGray : White
            },
            headerTintColor: isDarkMode ? '#FFFFFF' : '#111827', // White : DarkGray
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="TaskList" 
            component={TaskListScreen} 
            options={{ title: 'Airdrop Tasks' }} 
          />
          <Stack.Screen 
            name="TaskDetail" 
            component={TaskDetailScreen} 
            options={({ route }) => ({ title: route.params.taskName || 'Task Details' })} 
          />
          <Stack.Screen 
            name="AddTask" 
            component={AddTaskScreen} 
            options={{ title: 'Add New Task', presentation: 'modal' }} 
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen} 
            options={{ title: 'Settings' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;

// --- screens/TaskListScreen.tsx ---
// (Conceptual - you would create this file in a 'screens' folder)
// This screen would be similar to the main view of your web app.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import PushNotificationIOS from '@react-native-community/push-notification-ios'; // For iOS specific features
// import PushNotification from 'react-native-push-notification'; // General push notifications

// Import icons (e.g., from react-native-vector-icons, already in your react-native-setup.json)
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Example

import type { AirdropTask } from '../types';
import type { RootStackParamList } from '../App'; // Import stack param list

// Sample data structure (similar to web, but dates handled carefully)
const sampleMobileTasks: AirdropTask[] = [
  // ... (similar to web sample tasks, ensure dates are ISO strings for storage)
  // Example:
  {
    id: 'm1',
    name: 'Mobile Daily Check-in',
    description: 'Daily check-in on a mobile-specific platform',
    interval: 'daily',
    steps: [{ id: 'm1-s1', title: 'Open App', description: 'Open the target app', isCompleted: false, order: 1 }],
    streak: 5,
    lastCompleted: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    nextDue: new Date().toISOString(), // Today
    isActive: true,
    category: 'Mobile',
    priority: 'high',
    color: 'bg-teal-500' // Tailwind-like class, would need mapping in RN
  },
];


// Helper to map Tailwind-like colors to React Native styles if needed
const colorMap: { [key: string]: string } = {
  'bg-blue-500': '#3B82F6',
  'bg-purple-500': '#8B5CF6',
  'bg-green-500': '#10B981',
  'bg-red-500': '#EF4444',
  'bg-yellow-500': '#F59E0B',
  'bg-pink-500': '#EC4899',
  'bg-teal-500': '#14B8A6',
  // Priority colors (for border or background)
  'border-l-red-500': '#EF4444',
  'border-l-yellow-500': '#F59E0B',
  'border-l-green-500': '#10B981',
};

type TaskListNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TaskList'>;

const TaskListScreen = () => {
  const navigation = useNavigation<TaskListNavigationProp>();
  const [tasks, setTasks] = useState<AirdropTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isDarkMode = useColorScheme() === 'dark';

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedTasksString = await AsyncStorage.getItem('airdrop-tasks-mobile');
      if (savedTasksString) {
        const parsedTasks: AirdropTask[] = JSON.parse(savedTasksString);
        // Ensure dates are Date objects
        setTasks(parsedTasks.map(t => ({
          ...t,
          lastCompleted: t.lastCompleted ? new Date(t.lastCompleted) : null,
          nextDue: new Date(t.nextDue)
        })));
      } else {
        // Initialize with sample tasks if nothing in storage
         setTasks(sampleMobileTasks.map(t => ({
          ...t,
          lastCompleted: t.lastCompleted ? new Date(t.lastCompleted) : null,
          nextDue: new Date(t.nextDue)
        })));
      }
    } catch (e) {
      console.error('Failed to load tasks:', e);
      // Fallback to sample tasks on error
      setTasks(sampleMobileTasks.map(t => ({
        ...t,
        lastCompleted: t.lastCompleted ? new Date(t.lastCompleted) : null,
        nextDue: new Date(t.nextDue)
      })));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveTasks = async (tasksToSave: AirdropTask[]) => {
    try {
      const tasksWithStringDates = tasksToSave.map(t => ({
        ...t,
        lastCompleted: t.lastCompleted ? t.lastCompleted.toISOString() : null,
        nextDue: t.nextDue.toISOString()
      }));
      await AsyncStorage.setItem('airdrop-tasks-mobile', JSON.stringify(tasksWithStringDates));
    } catch (e) {
      console.error('Failed to save tasks:', e);
    }
  };
  
  // Load tasks when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTasks();
      // Potentially configure push notifications here or in App.tsx
      // configurePushNotifications();
      return () => {}; // Optional cleanup
    }, [loadTasks])
  );

  // Save tasks whenever they change
  useEffect(() => {
    if (!isLoading) { // Avoid saving during initial load if tasks are empty then populated
        saveTasks(tasks);
    }
  }, [tasks, isLoading]);


  // Placeholder for push notification setup
  // const configurePushNotifications = () => {
  //   PushNotification.configure({
  //     onRegister: function (token) {
  //       console.log("NOTIFICATION TOKEN:", token);
  //     },
  //     onNotification: function (notification) {
  //       console.log("NOTIFICATION:", notification);
  //       // Required on iOS only (see fetchCompletionHandler docs)
  //       if (Platform.OS === 'ios') {
  //         notification.finish(PushNotificationIOS.FetchResult.NoData);
  //       }
  //     },
  //     // Sender ID for Android GCM/FCM (from Firebase console)
  //     // senderID: "YOUR_SENDER_ID", 
  //     permissions: {
  //       alert: true,
  //       badge: true,
  //       sound: true,
  //     },
  //     popInitialNotification: true,
  //     requestPermissions: Platform.OS === 'ios',
  //   });
  // };

  // useEffect(() => {
  //   // Example: Schedule a local notification for a due task
  //   // This logic would be more sophisticated, checking actual due tasks
  //   const dueTask = tasks.find(t => new Date(t.nextDue) <= new Date() && t.isActive);
  //   if (dueTask) {
  //     PushNotification.localNotificationSchedule({
  //       channelId: "airdrop-reminders", // Ensure channel is created on Android
  //       title: "Airdrop Task Due!",
  //       message: `Your task "${dueTask.name}" is due.`,
  //       date: new Date(Date.now() + 5 * 1000), // 5 seconds from now for testing
  //       allowWhileIdle: true,
  //     });
  //   }
  // }, [tasks]);


  const renderItem = ({ item }: { item: AirdropTask }) => (
    <TouchableOpacity
      style={[
        styles.taskItem,
        { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
        { borderLeftColor: colorMap[item.priority === 'high' ? 'border-l-red-500' : item.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500'] || '#6B7280' }
      ]}
      onPress={() => navigation.navigate('TaskDetail', { taskId: item.id, taskName: item.name })}
    >
      <View style={styles.taskColorIndicatorContainer}>
        <View style={[styles.taskColorIndicator, { backgroundColor: colorMap[item.color] || '#60A5FA' }]} />
      </View>
      <View style={styles.taskInfo}>
        <Text style={[styles.taskName, { color: isDarkMode ? '#FFFFFF' : '#111827' }]}>{item.name}</Text>
        <Text style={[styles.taskDescription, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>{item.description}</Text>
        <View style={styles.taskMeta}>
          <Text style={styles.taskMetaText}>Streak: {item.streak}</Text>
          <Text style={styles.taskMetaText}>Next Due: {new Date(item.nextDue).toLocaleDateString()}</Text>
        </View>
      </View>
      {/* <Icon name="chevron-right" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} /> */}
    </TouchableOpacity>
  );

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.loader} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F3F4F6' }]}>
      <FlatList
        data={tasks.filter(task => task.isActive).sort((a,b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime())}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={[styles.emptyText, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>No active tasks. Add some!</Text>}
      />
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => navigation.navigate('AddTask')}
      >
        {/* <Icon name="plus" size={30} color="#FFFFFF" /> */}
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- screens/TaskDetailScreen.tsx ---
// (Conceptual)
// import React from 'react';
// import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
// // ... imports for task data, navigation, etc.
// const TaskDetailScreen = ({ route }) => {
//   const { taskId, taskName } = route.params;
//   // Fetch/find task by taskId
//   // Display steps, allow marking as complete
//   return (
//     <ScrollView style={styles.detailContainer}>
//       <Text style={styles.detailTitle}>{taskName}</Text>
//       {/* Map through task.steps here */}
//       <Button title="Mark as Complete" onPress={() => { /* ... complete logic ... */ }} />
//     </ScrollView>
//   );
// };

// --- screens/AddTaskScreen.tsx ---
// (Conceptual)
// import React, { useState } from 'react';
// import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
// // ... imports for saving task, navigation, etc.
// const AddTaskScreen = ({ navigation }) => {
//   // State for new task form
//   return (
//     <ScrollView style={styles.addContainer}>
//       <Text>Add New Task Screen</Text>
//       {/* Form inputs for name, description, interval, steps, etc. */}
//       <Button title="Save Task" onPress={() => { /* ... save logic ... */ navigation.goBack(); }} />
//     </ScrollView>
//   );
// };

// --- screens/SettingsScreen.tsx ---
// (Conceptual)
// import React from 'react';
// import { View, Text, Switch, StyleSheet } from 'react-native';
// // ... imports for managing settings (e.g., notifications, auto-start if applicable to mobile)
// const SettingsScreen = () => {
//   // State for settings toggles
//   return (
//     <View style={styles.settingsContainer}>
//       <Text>Settings Screen</Text>
//       {/* Example: <View><Text>Enable Notifications</Text><Switch ... /></View> */}
//     </View>
//   );
// };


// --- types.ts ---
// (Conceptual - in a 'types' folder or similar)
// Share this with web/desktop if possible, adjusting for platform differences.
// export interface TaskStep {
//   id: string;
//   title: string;
//   description: string;
//   isCompleted: boolean;
//   order: number;
// }
// export interface AirdropTask {
//   id: string;
//   name: string;
//   description: string;
//   interval: 'hourly' | 'daily' | 'weekly' | 'biweekly';
//   steps: TaskStep[];
//   streak: number;
//   lastCompleted: Date | null; // Use Date objects in memory
//   nextDue: Date;             // Use Date objects in memory
//   isActive: boolean;
//   category: string;
//   priority: 'low' | 'medium' | 'high';
//   color: string; // Tailwind-like class, map to RN style
// }

// --- Styles (Example for TaskListScreen) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskItem: {
    flexDirection: 'row',
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    borderLeftWidth: 5,
    elevation: 3, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    alignItems: 'center',
  },
  taskColorIndicatorContainer: {
    marginRight: 12,
  },
  taskColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 6,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskMetaText: {
    fontSize: 12,
    color: '#6B7280', // Medium Gray, adjust for dark mode
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  addButton: {
    position: 'absolute',
    right: 30,
    bottom: 30,
    backgroundColor: '#1D4ED8', // Blue-700
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 30, // Adjust for vertical centering of '+'
  },
  // Add styles for detail, add, settings screens as needed
  // detailContainer: { flex: 1, padding: 16 },
  // detailTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  // addContainer: { flex: 1, padding: 16 },
  // settingsContainer: { flex: 1, padding: 16 },
});

// On Android, you need to create a notification channel for SDK >= 26 (Android O)
// This should be done once, e.g., in App.tsx or when configuring notifications.
// if (Platform.OS === 'android') {
//   PushNotification.createChannel(
//     {
//       channelId: "airdrop-reminders", // Must be same as an FCM channel if you use FCM
//       channelName: "Airdrop Reminders",
//       channelDescription: "Channel for airdrop task reminders",
//       soundName: "default",
//       importance: 4, // Importance.HIGH
//       vibrate: true,
//     },
//     (created) => console.log(`createChannel returned '${created}'`)
//   );
// }

