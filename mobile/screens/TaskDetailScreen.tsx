// File: project-root/mobile/screens/TaskDetailScreen.tsx
// Description: This screen displays detailed information for a selected airdrop task,
// allowing users to view steps (now including descriptions), mark tasks as complete, and delete tasks.
// It is integrated with Firebase Firestore for data operations.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Firebase imports
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Import shared types from ../types.ts
import type { AirdropTask, TaskStep, RootStackParamList } from '../types';
// Import useTheme hook
import { useTheme } from '../ThemeContext';
// Import NotificationManager functions
import { scheduleNotification, cancelTaskNotification } from '../NotificationManager';
// Import Firestore helper
import { getTasksCollectionPathForUser } from '../utils/firestoreHelper'; 

// AsyncStorage for settings (still needed for local app preferences)
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const SETTINGS_STORAGE_KEY = 'airdrop-app-settings';

// Helper to map Tailwind-like colors
const colorMap: { [key: string]: string } = {
  'bg-blue-500': '#3B82F6', 'bg-purple-500': '#8B5CF6', 'bg-green-500': '#10B981',
  'bg-red-500': '#EF4444', 'bg-yellow-500': '#F59E0B', 'bg-pink-500': '#EC4899',
  'bg-teal-500': '#14B8A6', 'bg-indigo-500': '#6366F1', 'bg-gray-500': '#6B7280',
};

// Edit Icon
const EditIcon = ({ color }: { color: string }) => (
  <Text style={{ color: color, fontSize: Platform.OS === 'ios' ? 20 : 22, fontWeight: 'normal', marginRight: Platform.OS === 'ios' ? 0 : 5 }}>
    ✎
  </Text>
);

type TaskDetailRouteProp = RouteProp<RootStackParamList, 'TaskDetail'>;
type TaskDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;

const TaskDetailScreen = () => {
  const route = useRoute<TaskDetailRouteProp>();
  const navigation = useNavigation<TaskDetailNavigationProp>();
  const { taskId } = route.params;
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [task, setTask] = useState<AirdropTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<TaskStep[]>([]);
  const [enableNotificationsSetting, setEnableNotificationsSetting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const current_app_id = typeof __app_id !== 'undefined' ? __app_id : undefined;


  // Auth state listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      if (currentUser) {
        setUserId(currentUser.uid);
      } else {
        setUserId(null);
        setTask(null); 
        Alert.alert("Authentication Error", "You have been signed out.", [{ text: "OK", onPress: () => navigation.navigate('TaskList') }]);
      }
    });
    return subscriber;
  }, [navigation]);

  // Load notification preference from AsyncStorage
  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const settingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (settingsString) {
          const settings = JSON.parse(settingsString);
          setEnableNotificationsSetting(settings.enableNotifications || false);
        }
      } catch (error) {
        console.error("TaskDetailScreen: Failed to load notification settings", error);
      }
    };
    loadNotificationSettings();
  }, []);

  // Firestore listener for the specific task
  useEffect(() => {
    if (!userId || !taskId) {
      setIsLoading(false);
      if (!taskId && userId) navigation.goBack(); 
      return;
    }

    const tasksCollectionPath = getTasksCollectionPathForUser(userId, current_app_id);
    if (!tasksCollectionPath) {
        setIsLoading(false);
        Alert.alert("Error", "User not identified. Cannot load task details.");
        navigation.goBack();
        return;
    }
    
    setIsLoading(true);
    console.log(`TaskDetailScreen: Setting up Firestore listener for task ID: ${taskId} at path: ${tasksCollectionPath}`);

    const docRef = firestore().collection(tasksCollectionPath).doc(taskId);
    const unsubscribe = docRef.onSnapshot(docSnapshot => {
      if (docSnapshot.exists) {
        const taskData = docSnapshot.data() as any; 
        const fetchedTask: AirdropTask = {
          id: docSnapshot.id,
          ...taskData,
          lastCompleted: taskData.lastCompleted ? taskData.lastCompleted.toDate() : null,
          nextDue: taskData.nextDue.toDate(),
          steps: Array.isArray(taskData.steps) ? taskData.steps.sort((a: TaskStep, b: TaskStep) => a.order - b.order) : [],
        };
        setTask(fetchedTask);
        setCurrentSteps(fetchedTask.steps.map(s => ({ ...s, description: s.description || '' }))); // Ensure description is string
        console.log(`TaskDetailScreen: Task "${fetchedTask.name}" updated from Firestore.`);
      } else {
        console.warn(`TaskDetailScreen: Task with ID ${taskId} not found in Firestore.`);
        Alert.alert('Error', 'Task not found. It might have been deleted.');
        navigation.goBack();
      }
      setIsLoading(false);
    }, error => {
      console.error(`TaskDetailScreen: Error fetching task ${taskId} from Firestore:`, error);
      Alert.alert('Error', 'Could not load task details.');
      setIsLoading(false);
      navigation.goBack();
    });

    return () => {
      console.log(`TaskDetailScreen: Unsubscribing from Firestore listener for task ID: ${taskId}`);
      unsubscribe();
    };
  }, [userId, taskId, navigation, current_app_id]);


  // Update navigation options when task data is loaded
  useEffect(() => {
    if (task) {
      navigation.setOptions({
        title: task.name,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('AddTask', { taskIdToEdit: task.id });
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 5 }}
            disabled={isDeleting || isLoading || isCompleting}
          >
            <EditIcon color={isDarkMode ? '#FFFFFF' : '#111827'} />
          </TouchableOpacity>
        ),
      });
    }
  }, [task, navigation, isDarkMode, isDeleting, isLoading, isCompleting]);

  // Toggle step completion in local state
  const toggleStepCompletion = (stepId: string) => {
    setCurrentSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, isCompleted: !step.isCompleted } : step
      )
    );
  };

  // Calculate next due date
  const calculateNextDueDate = (startDate: Date, taskInterval: AirdropTask['interval']): Date => {
    const nextDue = new Date(startDate);
    if (taskInterval !== 'hourly') {
        nextDue.setHours(0, 0, 0, 0); 
    }
    switch (taskInterval) {
      case 'hourly': nextDue.setHours(startDate.getHours() + 1); break;
      case 'daily': nextDue.setDate(nextDue.getDate() + 1); break;
      case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break;
      case 'biweekly': nextDue.setDate(nextDue.getDate() + 14); break;
    }
    return nextDue;
  };

  // Handle task completion
  const handleCompleteTask = async () => {
    if (!task || isDeleting || isLoading || isCompleting || !userId) return;

    const allStepsCompleted = currentSteps.every(step => step.isCompleted);
    if (!allStepsCompleted && currentSteps.length > 0) {
      Alert.alert(
        "Incomplete Steps",
        "Not all steps are marked as complete. Do you want to proceed?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Proceed", onPress: () => completeTaskLogic() }
        ]
      );
    } else {
      completeTaskLogic();
    }
  };

  const completeTaskLogic = async () => {
    const tasksCollectionPath = getTasksCollectionPathForUser(userId, current_app_id);
    if (!task || !userId || !tasksCollectionPath) {
        Alert.alert("Error", "Cannot complete task. User or path error.");
        return;
    } 
    setIsCompleting(true);

    const now = new Date();
    const newNextDueDate = calculateNextDueDate(now, task.interval);
    
    const updatedTaskData: Partial<AirdropTask> & { updatedAt: any, notificationId: number | null } = { 
      lastCompleted: firestore.Timestamp.fromDate(now) as any, 
      nextDue: firestore.Timestamp.fromDate(newNextDueDate) as any, 
      streak: firestore.FieldValue.increment(1) as any, 
      steps: task.steps.map(step => ({ ...step, isCompleted: false })), 
      updatedAt: firestore.FieldValue.serverTimestamp(),
      notificationId: null, 
    };

    let newNotificationId: number | null = null;
    const taskForNotification: AirdropTask = {
        ...task,
        lastCompleted: now,
        nextDue: newNextDueDate,
        streak: (task.streak || 0) + 1, 
    };

    if (task.notificationId) {
      cancelTaskNotification(task.id); 
    }
    if (task.isActive && enableNotificationsSetting && newNextDueDate.getTime() > Date.now()) {
      newNotificationId = scheduleNotification(taskForNotification, newNextDueDate, true);
    }
    updatedTaskData.notificationId = newNotificationId ?? null;


    try {
      await firestore().collection(tasksCollectionPath).doc(task.id).update(updatedTaskData);
      Alert.alert("Task Complete!", `${task.name} has been marked as complete.`);
      navigation.navigate('TaskList', { refresh: true }); 
    } catch (e) {
      console.error('TaskDetailScreen: Failed to complete task in Firestore:', e);
      Alert.alert('Error', 'Could not update task in Firestore.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async () => {
    const tasksCollectionPath = getTasksCollectionPathForUser(userId, current_app_id);
    if (!task || isLoading || isCompleting || !userId || !tasksCollectionPath) return;

    Alert.alert(
      "Delete Task",
      `Are you sure you want to delete "${task.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              if (task.notificationId) {
                cancelTaskNotification(task.id); 
              }
              await firestore().collection(tasksCollectionPath).doc(task.id).delete();
              Alert.alert("Task Deleted", `"${task.name}" has been deleted.`);
              navigation.navigate('TaskList', { deletedTaskId: task.id, refresh: true });
            } catch (e) {
              console.error('TaskDetailScreen: Failed to delete task from Firestore:', e);
              Alert.alert('Error', 'Could not delete task from Firestore.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Theme styles
  const themeStyles = {
    containerBg: isDarkMode ? '#1F2937' : '#EDF2F7',
    cardBg: isDarkMode ? '#2D3748' : '#FFFFFF',
    textPrimary: isDarkMode ? '#E2E8F0' : '#1A202C',
    textSecondary: isDarkMode ? '#A0AEC0' : '#4A5568',
    textTertiary: isDarkMode ? '#718096' : '#718096',
    separatorColor: isDarkMode ? '#4A5568' : '#E2E8F0',
    stepCompletedColor: isDarkMode ? '#38A169' : '#48BB78',
    stepPendingColor: isDarkMode ? '#A0AEC0' : '#718096',
    actionButtonCompleteBg: isDarkMode ? '#2B6CB0' : '#3182CE',
    actionButtonDeleteBg: isDarkMode ? '#C53030' : '#E53E3E',
    loaderColor: isDarkMode ? '#FFFFFF' : '#1D4ED8',
    stepDescriptionText: isDarkMode ? '#BCCCDC' : '#5A6578', // Lighter secondary for dark, darker for light
  };

  // Loading UI
  if (isLoading && !task) { 
    return (
      <View style={[styles.loaderContainer, { backgroundColor: themeStyles.containerBg }]}>
        <ActivityIndicator size="large" color={themeStyles.loaderColor} />
        <Text style={[styles.loadingText, {color: themeStyles.textSecondary}]}>Loading Task Details...</Text>
      </View>
    );
  }
  
  if (!task) { 
      return (
          <View style={[styles.loaderContainer, { backgroundColor: themeStyles.containerBg }]}>
              <Text style={[styles.loadingText, {color: themeStyles.textSecondary}]}>Task data not available or user not signed in.</Text>
          </View>
      );
  }

  // Main component render
  return (
    <ScrollView 
        style={[styles.container, { backgroundColor: themeStyles.containerBg }]}
        contentContainerStyle={{ paddingBottom: 20 }} >
      <View style={[styles.card, { backgroundColor: themeStyles.cardBg }]}>
        <View style={styles.headerSection}>
            <View style={[styles.colorIndicator, { backgroundColor: colorMap[task.color || 'bg-gray-500'] || themeStyles.textSecondary }]} />
            <Text style={[styles.taskName, { color: themeStyles.textPrimary }]}>{task.name}</Text>
        </View>
        {task.description && <Text style={[styles.description, { color: themeStyles.textSecondary }]}>{task.description}</Text>}
        <View style={styles.metaGrid}>
            <View style={styles.metaItem}><Text style={[styles.metaLabel, {color: themeStyles.textTertiary}]}>Priority</Text><Text style={[styles.metaValue, {color: themeStyles.textPrimary}]}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</Text></View>
            <View style={styles.metaItem}><Text style={[styles.metaLabel, {color: themeStyles.textTertiary}]}>Category</Text><Text style={[styles.metaValue, {color: themeStyles.textPrimary}]}>{task.category}</Text></View>
            <View style={styles.metaItem}><Text style={[styles.metaLabel, {color: themeStyles.textTertiary}]}>Interval</Text><Text style={[styles.metaValue, {color: themeStyles.textPrimary}]}>{task.interval.charAt(0).toUpperCase() + task.interval.slice(1)}</Text></View>
            <View style={styles.metaItem}><Text style={[styles.metaLabel, {color: themeStyles.textTertiary}]}>Streak</Text><Text style={[styles.metaValue, {color: themeStyles.textPrimary, fontWeight: 'bold'}]}>{task.streak}</Text></View>
        </View>
         <View style={[styles.metaGrid, {marginTop: 5, borderTopWidth: 1, borderTopColor: themeStyles.separatorColor, paddingTop: 10}]}>
            <View style={styles.metaItem}><Text style={[styles.metaLabel, {color: themeStyles.textTertiary}]}>Last Completed</Text><Text style={[styles.metaValue, {color: themeStyles.textPrimary}]}>{task.lastCompleted ? new Date(task.lastCompleted).toLocaleDateString() : 'Never'}</Text></View>
            <View style={styles.metaItem}><Text style={[styles.metaLabel, {color: themeStyles.textTertiary}]}>Next Due</Text><Text style={[styles.metaValue, {color: themeStyles.textPrimary, fontWeight: 'bold'}]}>{new Date(task.nextDue).toLocaleDateString()}</Text></View>
        </View>
      </View>

      {currentSteps.length > 0 && (
        <View style={[styles.card, { backgroundColor: themeStyles.cardBg, marginTop: 12 }]}>
          <Text style={[styles.stepsHeader, { color: themeStyles.textPrimary }]}>Steps to Complete</Text>
          {currentSteps.map((step, index) => (
            <TouchableOpacity 
                key={step.id} 
                style={[styles.stepItem, index === currentSteps.length -1 ? {} : { borderBottomWidth: 1, borderBottomColor: themeStyles.separatorColor } ]} 
                onPress={() => toggleStepCompletion(step.id)} 
                activeOpacity={0.7} 
                disabled={isLoading || isDeleting || isCompleting} 
            >
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                    <View style={[styles.stepCheckbox, {borderColor: step.isCompleted ? themeStyles.stepCompletedColor : themeStyles.stepPendingColor }]}>{step.isCompleted && <View style={[styles.stepCheckboxInner, {backgroundColor: themeStyles.stepCompletedColor}]} />}</View>
                    <Text style={[styles.stepText, { color: step.isCompleted ? themeStyles.textTertiary : themeStyles.textPrimary, textDecorationLine: step.isCompleted ? 'line-through' : 'none'}]}>{step.order}. {step.title}</Text>
                </View>
                {step.description && step.description.trim() !== '' && (
                    <Text style={[styles.stepDescription, { color: themeStyles.stepDescriptionText, textDecorationLine: step.isCompleted ? 'line-through' : 'none' }]}>
                        {step.description}
                    </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity 
        style={[styles.actionButton, styles.completeButton, { backgroundColor: themeStyles.actionButtonCompleteBg, opacity: (isLoading || isDeleting || isCompleting || !task.isActive) ? 0.5 : 1 }]} 
        onPress={handleCompleteTask} 
        disabled={isLoading || isDeleting || isCompleting || !task.isActive} 
      >
        {isCompleting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionButtonText}>Mark Task as Complete</Text>}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, styles.deleteButton, { backgroundColor: themeStyles.actionButtonDeleteBg, opacity: (isLoading || isDeleting || isCompleting) ? 0.5 : 1 }]} 
        onPress={handleDeleteTask} 
        disabled={isLoading || isDeleting || isCompleting}
      >
        {isDeleting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionButtonText}>Delete Task</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, },
  loadingText: { marginTop: 10, fontSize: 16, textAlign: 'center', },
  card: { marginHorizontal: 12, marginTop: 12, padding: 16, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  headerSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  colorIndicator: { width: 18, height: 18, borderRadius: 9, marginRight: 10 },
  taskName: { fontSize: 22, fontWeight: 'bold', flexShrink: 1 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metaItem: { minWidth: '45%', marginBottom: 10 },
  metaLabel: { fontSize: 13, marginBottom: 3 },
  metaValue: { fontSize: 15, fontWeight: '500' },
  stepsHeader: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  stepItem: { paddingVertical: 12 }, // Removed flexDirection: 'row' to allow description below
  stepContent: { flexDirection: 'column' }, // New container for title row and description
  stepTitleRow: { flexDirection: 'row', alignItems: 'center' }, // Existing row for checkbox and title
  stepCheckbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  stepCheckboxInner: { width: 12, height: 12, borderRadius: 2 },
  stepText: { fontSize: 16, flex: 1 },
  stepDescription: { fontSize: 13, marginLeft: 34, // Align with title (checkbox width + margin)
    marginTop: 4, fontStyle: 'italic', opacity: 0.8 },
  actionButton: { marginHorizontal: 12, marginTop: 15, paddingVertical: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 4 },
  actionButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  completeButton: {},
  deleteButton: {},
});

export default TaskDetailScreen;
