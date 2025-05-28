// File: project-root/mobile/screens/TaskListScreen.tsx
// Description: This screen displays the list of airdrop tasks, now integrated with Firebase Firestore
// for real-time data synchronization and offline persistence.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Firebase imports - ensure you have @react-native-firebase/app, @react-native-firebase/auth, @react-native-firebase/firestore installed and setup
// For this example, we'll use the modular Web SDK syntax which is common, but native modules are preferred for RN.
// Assume firebase is initialized in a central file (e.g., mobile/firebaseConfig.ts or App.tsx)
import { firebase } from '@react-native-firebase/firestore'; // Using @react-native-firebase
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Import shared types from ../types.ts
import type { AirdropTask, TaskStep, RootStackParamList } from '../types';
// Import useTheme hook
import { useTheme } from '../ThemeContext';
// Import NotificationManager functions
import { scheduleNotification, cancelTaskNotification, generateNumericNotificationId } from '../NotificationManager';

// Constants for Firestore and settings
const TASKS_COLLECTION_BASE_PATH = 'artifacts'; // Base path as per security rules
const APP_ID_PLACEHOLDER = 'crypto-airdrop-manager-mobile'; // Replace with actual app ID if dynamic
const TASK_LIST_SETTINGS_KEY = 'airdrop-task-list-settings-v2'; // AsyncStorage key for list display settings
const SETTINGS_STORAGE_KEY = 'airdrop-app-settings'; // AsyncStorage key for general app settings
const ALL_CATEGORIES_KEY = "All Categories";

// Helper for color mapping (remains the same)
const colorMap: { [key: string]: string } = {
  'bg-blue-500': '#3B82F6', 'bg-purple-500': '#8B5CF6', 'bg-green-500': '#10B981',
  'bg-red-500': '#EF4444', 'bg-yellow-500': '#F59E0B', 'bg-pink-500': '#EC4899',
  'bg-teal-500': '#14B8A6',
  'border-l-red-500': '#EF4444', 'border-l-yellow-500': '#F59E0B', 'border-l-green-500': '#10B981',
};

// Types for sorting and settings (remains the same)
type SortCriteria = 'nextDue' | 'name' | 'priority' | 'streak';
type SortOrder = 'asc' | 'desc';
interface TaskListSettings {
    showInactive: boolean;
    sortBy: SortCriteria;
    sortOrder: SortOrder;
    selectedCategory: string;
}

// Navigation and Route props (remains the same)
type TaskListNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TaskList'>;
type TaskListRouteProp = RouteProp<RootStackParamList, 'TaskList'>;

const TaskListScreen = () => {
  const navigation = useNavigation<TaskListNavigationProp>();
  const route = useRoute<TaskListRouteProp>();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [tasks, setTasks] = useState<AirdropTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableNotificationsSetting, setEnableNotificationsSetting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [listSettings, setListSettings] = useState<TaskListSettings>({
      showInactive: false,
      sortBy: 'nextDue',
      sortOrder: 'asc',
      selectedCategory: ALL_CATEGORIES_KEY,
  });

  // Memoized categories from tasks (remains the same)
  const availableCategories = useMemo(() => {
    const categories = new Set(tasks.map(task => task.category).filter(Boolean));
    return [ALL_CATEGORIES_KEY, ...Array.from(categories).sort()];
  }, [tasks]);

  // Get tasks collection path for the current user
  const getTasksCollectionPathForUser = useCallback(() => {
    if (!userId) return null;
    // Using the private data path structure: artifacts/{appId}/users/{userId}/{your_collection_name}
    // __app_id is typically available in a global scope in the web version.
    // For mobile, you might hardcode it or fetch from a config.
    const appId = typeof __app_id !== 'undefined' ? __app_id : APP_ID_PLACEHOLDER;
    return `${TASKS_COLLECTION_BASE_PATH}/${appId}/users/${userId}/airdropTasks_mobile`;
  }, [userId]);


  // Effect for Firebase Auth state
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      if (currentUser) {
        setUserId(currentUser.uid);
        console.log("TaskListScreen: User authenticated, UID:", currentUser.uid);
      } else {
        setUserId(null);
        setTasks([]); // Clear tasks if user logs out
        setIsLoading(false);
        console.log("TaskListScreen: User logged out.");
        // Potentially navigate to a login screen if auth is mandatory
        // navigation.navigate('AuthScreen');
      }
    });
    return subscriber; // Unsubscribe on unmount
  }, []);


  // Load global notification setting from AsyncStorage (remains similar)
  const loadAppSettings = useCallback(async () => {
    try {
        // AsyncStorage is still used for app-specific settings not stored in Firestore
        const storedSettings = await Platform.select({
            native: () => import('@react-native-async-storage/async-storage'),
            default: () => import('@react-native-async-storage/async-storage'),
        })().then(module => module.default.getItem(SETTINGS_STORAGE_KEY));

        if (storedSettings) {
            const parsed = JSON.parse(storedSettings);
            setEnableNotificationsSetting(parsed.enableNotifications || false);
            return parsed.enableNotifications || false;
        }
    } catch (error) {
        console.error("TaskListScreen: Failed to load app settings from AsyncStorage:", error);
    }
    return false;
  }, []);

  // Load list display settings from AsyncStorage (remains similar)
  useEffect(() => {
    loadAppSettings();
    const loadListSettings = async () => {
        try {
            const storedSettings = await Platform.select({
                native: () => import('@react-native-async-storage/async-storage'),
                default: () => import('@react-native-async-storage/async-storage'),
            })().then(module => module.default.getItem(TASK_LIST_SETTINGS_KEY));
            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);
                if (!parsedSettings.selectedCategory) {
                    parsedSettings.selectedCategory = ALL_CATEGORIES_KEY;
                }
                setListSettings(parsedSettings);
            }
        } catch (error) {
            console.error("TaskListScreen: Failed to load list settings from AsyncStorage:", error);
        }
    };
    loadListSettings();
  }, [loadAppSettings]);

  // Save list display settings to AsyncStorage (remains similar)
  useEffect(() => {
    const saveListSettings = async () => {
        try {
            await Platform.select({
                native: () => import('@react-native-async-storage/async-storage'),
                default: () => import('@react-native-async-storage/async-storage'),
            })().then(module => module.default.setItem(TASK_LIST_SETTINGS_KEY, JSON.stringify(listSettings)));
        } catch (error) {
            console.error("TaskListScreen: Failed to save list settings to AsyncStorage:", error);
        }
    };
    if(!isLoading && tasks.length > 0) { // Only save if not loading and tasks are present
        saveListSettings();
    }
  }, [listSettings, isLoading, tasks.length]);


  // Firestore listener for tasks
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setTasks([]); // Clear tasks if no user
      return;
    }

    const tasksCollectionPath = getTasksCollectionPathForUser();
    if (!tasksCollectionPath) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    console.log(`TaskListScreen: Setting up Firestore listener for path: ${tasksCollectionPath}`);

    const unsubscribe = firestore()
      .collection(tasksCollectionPath)
      .onSnapshot(async (querySnapshot) => {
        console.log("TaskListScreen: Firestore snapshot received. Documents count:", querySnapshot.size);
        const currentNotificationSetting = await loadAppSettings(); // Refresh setting
        let tasksNeedSavingToFirestore = false; // To track if any notificationId needs update in Firestore

        const fetchedTasks: AirdropTask[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const task: AirdropTask = {
            id: doc.id,
            name: data.name || 'Untitled Task',
            description: data.description || '',
            interval: data.interval || 'daily',
            steps: Array.isArray(data.steps) ? data.steps : [],
            streak: data.streak || 0,
            lastCompleted: data.lastCompleted ? (data.lastCompleted as firebase.firestore.Timestamp).toDate() : null,
            nextDue: data.nextDue ? (data.nextDue as firebase.firestore.Timestamp).toDate() : new Date(),
            isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
            category: data.category || 'Uncategorized',
            priority: data.priority || 'medium',
            color: data.color || 'bg-gray-500',
            notificationId: data.notificationId, // Keep existing numeric notificationId
          };

          // Process notifications for each task
          let newNotificationId = task.notificationId;
          if (task.isActive && currentNotificationSetting) {
            if (task.nextDue.getTime() > Date.now()) {
              // If task.notificationId is undefined or different from a newly generated one, reschedule.
              // This is a simplified check; ideally, you'd also check if the due date or other relevant info changed.
              const expectedNumericId = generateNumericNotificationId(task.id);
              if (task.notificationId !== expectedNumericId) { // Basic check if ID is missing or seems incorrect
                  if (task.notificationId) cancelTaskNotification(task.id); // Cancel old one by task ID
                  newNotificationId = scheduleNotification(task, task.nextDue, true);
                  if (newNotificationId !== task.notificationId) {
                      tasksNeedSavingToFirestore = true;
                      // Update Firestore with the new notificationId in a batch or individually
                      firestore().collection(tasksCollectionPath).doc(task.id).update({ notificationId: newNotificationId }).catch(e => console.error("Error updating notificationId in Firestore:", e));
                  }
              }
            } else if (task.notificationId) { // Due date is past, ensure notification is cancelled
              cancelTaskNotification(task.id);
              newNotificationId = undefined;
              if (newNotificationId !== task.notificationId) {
                  tasksNeedSavingToFirestore = true;
                  firestore().collection(tasksCollectionPath).doc(task.id).update({ notificationId: newNotificationId }).catch(e => console.error("Error clearing notificationId in Firestore:", e));
              }
            }
          } else if (task.notificationId) { // Task inactive or notifications disabled, cancel existing
            cancelTaskNotification(task.id);
            newNotificationId = undefined;
            if (newNotificationId !== task.notificationId) {
                tasksNeedSavingToFirestore = true;
                firestore().collection(tasksCollectionPath).doc(task.id).update({ notificationId: newNotificationId }).catch(e => console.error("Error clearing notificationId in Firestore:", e));
            }
          }
          return { ...task, notificationId: newNotificationId };
        });

        setTasks(fetchedTasks);
        setIsLoading(false);
        console.log("TaskListScreen: Tasks updated from Firestore.");

      }, (error) => {
        console.error("TaskListScreen: Error fetching tasks from Firestore:", error);
        Alert.alert("Error", "Could not fetch tasks. Please check your connection.");
        setIsLoading(false);
      });

    return () => {
      console.log("TaskListScreen: Unsubscribing from Firestore listener.");
      unsubscribe();
    };
  }, [userId, getTasksCollectionPathForUser, loadAppSettings]); // Re-run if userId or collection path changes


  // Handle task updates from other screens (e.g., AddTaskScreen, TaskDetailScreen)
  // This effect might become less critical if all mutations are directly to Firestore
  // and the onSnapshot listener handles UI updates. However, it's good for immediate feedback.
  useEffect(() => {
    const { updatedTask, completedTaskId, newTask, deletedTaskId, refresh } = route.params || {};
    
    if (refresh) { // If a full refresh is requested (e.g., after clearing all data)
        // The Firestore listener should automatically refresh, but this ensures isLoading is handled.
        // No direct action needed here if listener is robust.
        navigation.setParams({ refresh: undefined });
    }

    // The Firestore listener should handle these changes automatically.
    // If direct manipulation of local state is still desired for immediate UI feedback
    // before Firestore syncs, that logic could be here, but it adds complexity.
    // For now, relying on Firestore's real-time updates.
    if (updatedTask || newTask || deletedTaskId) {
        console.log("TaskListScreen: Route params received, relying on Firestore listener for updates.", route.params);
        // Clear params to prevent re-processing
        navigation.setParams({ updatedTask: undefined, completedTaskId: undefined, newTask: undefined, deletedTaskId: undefined });
    }

  }, [route.params, navigation]);


  // Toggle task active state (now updates Firestore)
  const handleToggleActive = async (taskIdToToggle: string, currentIsActive: boolean) => {
    if (!userId) return;
    const tasksCollectionPath = getTasksCollectionPathForUser();
    if (!tasksCollectionPath) return;

    const taskToUpdate = tasks.find(t => t.id === taskIdToToggle);
    if (!taskToUpdate) return;

    const updatedIsActive = !currentIsActive;
    let newNotificationId: number | undefined | null = taskToUpdate.notificationId;

    // Update notification based on new active state
    if (updatedIsActive) { // Task is being activated
        if (enableNotificationsSetting && taskToUpdate.nextDue.getTime() > Date.now()) {
            if (taskToUpdate.notificationId) cancelTaskNotification(taskToUpdate.id); // Cancel old, if any
            newNotificationId = scheduleNotification(taskToUpdate, taskToUpdate.nextDue, true);
            console.log(`Task ${taskToUpdate.name} activated, scheduled notification ID: ${newNotificationId}`);
        } else if (enableNotificationsSetting) {
            console.log(`Task ${taskToUpdate.name} activated, but due date is past or notifications off. No new notification scheduled.`);
             if (taskToUpdate.notificationId) { // If it had one, clear it
                cancelTaskNotification(taskToUpdate.id);
                newNotificationId = undefined;
             }
        }
    } else { // Task is being deactivated
        if (taskToUpdate.notificationId) {
            cancelTaskNotification(taskToUpdate.id);
            console.log(`Task ${taskToUpdate.name} deactivated, cancelled notification ID: ${taskToUpdate.notificationId}`);
        }
        newNotificationId = undefined;
    }

    try {
      await firestore().collection(tasksCollectionPath).doc(taskIdToToggle).update({
        isActive: updatedIsActive,
        notificationId: newNotificationId, // Store the numeric ID or null/undefined
        // updatedAt: firestore.FieldValue.serverTimestamp(), // Good practice
      });
      console.log(`TaskListScreen: Task ${taskIdToToggle} active state updated in Firestore to ${updatedIsActive}. Notification ID: ${newNotificationId}`);
      // UI will update via onSnapshot listener
    } catch (error) {
      console.error("TaskListScreen: Error toggling task active state in Firestore:", error);
      Alert.alert("Error", "Could not update task status.");
    }
  };

  // Priority style helper (remains the same)
  const getPriorityStyle = (priority: AirdropTask['priority']) => {
    if (priority === 'high') return { borderLeftColor: colorMap['border-l-red-500'] || '#EF4444', borderLeftWidth: 5 };
    if (priority === 'medium') return { borderLeftColor: colorMap['border-l-yellow-500'] || '#F59E0B', borderLeftWidth: 5 };
    return { borderLeftColor: colorMap['border-l-green-500'] || '#10B981', borderLeftWidth: 5 };
  };

  // Theme styles (remains the same)
  const themeStyles = {
    containerBg: isDarkMode ? '#1A202C' : '#F7FAFC',
    cardBg: isDarkMode ? '#2D3748' : '#FFFFFF',
    textPrimary: isDarkMode ? '#E2E8F0' : '#1A202C',
    textSecondary: isDarkMode ? '#A0AEC0' : '#4A5568',
    textTertiary: isDarkMode ? '#718096' : '#718096',
    loaderColor: isDarkMode ? '#FFFFFF' : '#1D4ED8',
    fabBg: isDarkMode ? '#2B6CB0': '#3182CE',
    chevronColor: isDarkMode ? '#718096' : '#A0AEC0',
    switchThumbColor: Platform.OS === 'android' ? (isDarkMode ? '#A0AEC0' : '#FFFFFF') : undefined,
    switchTrackColor: { false: isDarkMode ? '#4A5568' : '#E2E8F0', true: isDarkMode ? '#38A169' : '#48BB78' },
    filterButtonBg: isDarkMode ? '#2D3748' : '#E2E8F0',
    filterButtonText: isDarkMode ? '#A0AEC0' : '#4A5568',
    filterButtonActiveBg: isDarkMode ? '#4A5568' : '#CBD5E0',
    filterButtonActiveText: isDarkMode ? '#E2E8F0' : '#1A202C',
    searchInputBg: isDarkMode ? '#2D3748' : '#FFFFFF',
    searchInputText: isDarkMode ? '#E2E8F0' : '#1A202C',
    searchInputPlaceholder: isDarkMode ? '#718096' : '#A0AEC0',
    searchInputClearButton: isDarkMode ? '#A0AEC0' : '#718096',
    controlButtonBorder: isDarkMode ? '#4A5568' : '#CBD5E0',
    categoryButtonBorder: isDarkMode ? '#374151' : '#D1D5DB',
  };

  // Render task item (remains largely the same, Switch now calls updated handleToggleActive)
  const renderItem = ({ item }: { item: AirdropTask }) => (
    <View style={!item.isActive && { opacity: 0.6 }}>
      <TouchableOpacity
        style={[ styles.taskItem, { backgroundColor: themeStyles.cardBg }, getPriorityStyle(item.priority) ]}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id, taskName: item.name })}
        disabled={!item.isActive && !listSettings.showInactive} >
        <View style={styles.taskColorIndicatorContainer}><View style={[styles.taskColorIndicator, { backgroundColor: colorMap[item.color] || themeStyles.textSecondary }]} /></View>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskName, { color: themeStyles.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.taskDescription, { color: themeStyles.textSecondary }]} numberOfLines={2}>{item.description}</Text>
          <View style={styles.taskMeta}>
            <Text style={[styles.taskMetaText, { color: themeStyles.textTertiary }]}>Streak: {item.streak}</Text>
            <Text style={[styles.taskMetaText, { color: themeStyles.textTertiary }]}>Next Due: {new Date(item.nextDue).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={styles.taskActions}>
            <Switch
                trackColor={themeStyles.switchTrackColor}
                thumbColor={item.isActive ? (Platform.OS === 'ios' ? '#FFFFFF' : (isDarkMode ? '#38A169' : '#48BB78')) : themeStyles.switchThumbColor}
                ios_backgroundColor={themeStyles.switchTrackColor.false}
                onValueChange={() => handleToggleActive(item.id, item.isActive)}
                value={item.isActive}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
            <Text style={{ color: themeStyles.chevronColor, marginLeft: 8 }}>&gt;</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // Priority order for sorting (remains the same)
  const priorityOrder = { low: 3, medium: 2, high: 1 };

  // Filtered and sorted tasks logic (remains the same)
  const filteredAndSortedTasks = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    let processedTasks = tasks.filter(task => {
        const matchesActivity = listSettings.showInactive ? true : task.isActive;
        if (!matchesActivity) return false;
        const matchesCategory = listSettings.selectedCategory === ALL_CATEGORIES_KEY || task.category === listSettings.selectedCategory;
        if(!matchesCategory) return false;
        if (searchQuery.trim() === '') return true;
        const matchesName = task.name.toLowerCase().includes(lowercasedQuery);
        const matchesDescription = task.description.toLowerCase().includes(lowercasedQuery);
        return matchesName || matchesDescription;
      });
    processedTasks.sort((a, b) => {
        let comparison = 0;
        switch (listSettings.sortBy) {
            case 'name': comparison = a.name.localeCompare(b.name); break;
            case 'priority': comparison = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
            case 'streak': comparison = b.streak - a.streak; break;
            case 'nextDue': default: comparison = new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime(); break;
        }
        return listSettings.sortOrder === 'asc' ? comparison : comparison * -1;
    });
    return processedTasks;
  }, [tasks, listSettings.showInactive, searchQuery, listSettings.sortBy, listSettings.sortOrder, listSettings.selectedCategory]);

  // Loading state UI (remains the same)
  if (isLoading && tasks.length === 0 && userId) { // Show loading only if user is logged in and no tasks yet
    return (
      <View style={[styles.loaderContainer, { backgroundColor: themeStyles.containerBg }]}>
        <ActivityIndicator size="large" color={themeStyles.loaderColor} />
        <Text style={[styles.loadingText, {color: themeStyles.textSecondary}]}>Loading Tasks from Cloud...</Text>
      </View>
    );
  }

  if (!userId && !isLoading) { // If no user and not loading, prompt for login or show message
      return (
          <View style={[styles.loaderContainer, { backgroundColor: themeStyles.containerBg }]}>
              <Text style={[styles.loadingText, {color: themeStyles.textSecondary, textAlign: 'center'}]}>
                  Please sign in to manage your tasks.
              </Text>
              {/* Optionally, add a sign-in button here if navigation to auth screen is not automatic */}
          </View>
      );
  }

  // Sort controls logic (remains the same)
  const cycleSortOrder = () => setListSettings(prev => ({...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'}));
  const cycleSortBy = () => {
    const criteria: SortCriteria[] = ['nextDue', 'name', 'priority', 'streak'];
    const currentIndex = criteria.indexOf(listSettings.sortBy);
    const nextIndex = (currentIndex + 1) % criteria.length;
    setListSettings(prev => ({...prev, sortBy: criteria[nextIndex], sortOrder: 'asc' }));
  };
  const getSortLabel = () => {
      const labels: Record<SortCriteria, string> = { nextDue: "Due Date", name: "Name", priority: "Priority", streak: "Streak" };
      return `${labels[listSettings.sortBy]} (${listSettings.sortOrder === 'asc' ? '▲' : '▼'})`;
  }

  // Main component render (remains largely the same structure)
  return (
    <View style={[styles.container, { backgroundColor: themeStyles.containerBg }]}>
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
            <TextInput style={[styles.searchInput, {backgroundColor: themeStyles.searchInputBg, color: themeStyles.searchInputText, borderColor: themeStyles.controlButtonBorder}]} placeholder="Search tasks..." placeholderTextColor={themeStyles.searchInputPlaceholder} value={searchQuery} onChangeText={setSearchQuery} clearButtonMode="while-editing" />
            {Platform.OS === 'android' && searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButtonAndroid}><Text style={{color: themeStyles.searchInputClearButton, fontSize: 18}}>✕</Text></TouchableOpacity>)}
        </View>
        <View style={styles.filterSortRow}>
            <TouchableOpacity style={[styles.controlButton, {backgroundColor: listSettings.showInactive ? themeStyles.filterButtonActiveBg : themeStyles.filterButtonBg}]} onPress={() => setListSettings(prev => ({...prev, showInactive: !prev.showInactive}))} >
                <Text style={{color: listSettings.showInactive ? themeStyles.filterButtonActiveText : themeStyles.filterButtonText, fontWeight: '500'}}>{listSettings.showInactive ? "Active Only" : "Show All"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, {backgroundColor: themeStyles.filterButtonBg, marginLeft: 8}]} onPress={cycleSortBy} onLongPress={cycleSortOrder} >
                <Text style={{color: themeStyles.filterButtonText, fontWeight: '500'}}>Sort: {getSortLabel()}</Text>
            </TouchableOpacity>
        </View>
        {availableCategories.length > 1 && (
            <View style={styles.categoryFilterContainer}>
                <Text style={[styles.categoryFilterLabel, {color: themeStyles.textSecondary}]}>Category:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    {availableCategories.map(category => (
                        <TouchableOpacity key={category} style={[styles.categoryButton, { backgroundColor: listSettings.selectedCategory === category ? themeStyles.filterButtonActiveBg : themeStyles.filterButtonBg, borderColor: listSettings.selectedCategory === category ? themeStyles.filterButtonActiveText : themeStyles.categoryButtonBorder }]} onPress={() => setListSettings(prev => ({...prev, selectedCategory: category}))} >
                            <Text style={{color: listSettings.selectedCategory === category ? themeStyles.filterButtonActiveText : themeStyles.filterButtonText, fontWeight: '500'}}>{category}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}
      </View>
      <FlatList
        data={filteredAndSortedTasks} renderItem={renderItem} keyExtractor={item => item.id}
        ListEmptyComponent={ <View style={styles.emptyContainer}><Text style={[styles.emptyText, {color: themeStyles.textSecondary}]}>{searchQuery || listSettings.selectedCategory !== ALL_CATEGORIES_KEY ? "No tasks match current filters." : (listSettings.showInactive && tasks.length > 0 && filteredAndSortedTasks.length === 0 ? "No inactive tasks." : (userId ? "No tasks yet. Add some!" : "Please sign in."))}</Text>{!searchQuery && listSettings.selectedCategory === ALL_CATEGORIES_KEY && !listSettings.showInactive && tasks.length === 0 && userId && (<Text style={[styles.emptySubText, {color: themeStyles.textTertiary}]}>Tap the '+' button to add your first airdrop task!</Text>)}</View> }
        contentContainerStyle={filteredAndSortedTasks.length === 0 ? styles.emptyFlatlistContent : {paddingBottom: 80}}
        // onRefresh={() => { if (userId) { /* Firestore handles refresh via listener */ setIsLoading(true); /* Potentially force re-fetch if needed */ } }} // onRefresh might not be needed with Firestore listener
        refreshing={isLoading && tasks.length > 0} // Show refreshing indicator if loading new data while some tasks are already displayed
        keyboardShouldPersistTaps="handled" />
      <TouchableOpacity style={[styles.addButton, {backgroundColor: themeStyles.fabBg}]} onPress={() => navigation.navigate('AddTask', {})} activeOpacity={0.7} >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

// Styles (remain the same)
const styles = StyleSheet.create({
  container: { flex: 1 },
  controlsContainer: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)'},
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  searchInput: { flex: 1, height: 44, paddingHorizontal: 12, borderRadius: 8, fontSize: 16, borderWidth: 1 },
  clearButtonAndroid: { padding: 8, position: 'absolute', right: 5, height: 44, justifyContent: 'center' },
  filterSortRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  controlButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', marginRight: 8, marginBottom: 8 },
  categoryFilterContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  categoryFilterLabel: { marginRight: 8, fontSize: 14, fontWeight: '500' },
  categoryScroll: { paddingVertical: 4 },
  categoryButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, marginRight: 8 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, },
  loadingText: { marginTop: 10, fontSize: 16 },
  taskItem: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, marginVertical: 6, marginHorizontal: 12, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, alignItems: 'center' },
  taskColorIndicatorContainer: { marginRight: 12, padding: 3, alignSelf: 'flex-start', marginTop: 2 },
  taskColorIndicator: { width: 10, height: 10, borderRadius: 5 },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 17, fontWeight: '600', marginBottom: 3 },
  taskDescription: { fontSize: 13, marginBottom: 6 },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  taskMetaText: { fontSize: 11, fontWeight: '500' },
  taskActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }, // Changed from marginLeft: 10
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginTop: '30%' },
  emptyText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  emptySubText: { fontSize: 14, textAlign: 'center' },
  emptyFlatlistContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  addButton: { position: 'absolute', right: 25, bottom: 25, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  addButtonText: { color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontWeight: '300' },
});

export default TaskListScreen;
