// File: project-root/mobile/screens/AddTaskScreen.tsx
// Description: This screen allows users to add new airdrop tasks or edit existing ones,
// now integrated with Firebase Firestore for data persistence.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch, // Added Switch back for isActive toggle
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

// Firebase imports
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Import shared types from ../types.ts
import type { AirdropTask, TaskStep, RootStackParamList } from '../types';
// Import useTheme hook
import { useTheme } from '../ThemeContext';
// Import NotificationManager functions
import { scheduleNotification, cancelTaskNotification, generateNumericNotificationId } from '../NotificationManager';

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Color mapping (remains the same)
const colorMap: { [key: string]: string } = {
  'bg-blue-500': '#3B82F6', 'bg-purple-500': '#8B5CF6', 'bg-green-500': '#10B981',
  'bg-red-500': '#EF4444', 'bg-yellow-500': '#F59E0B', 'bg-pink-500': '#EC4899',
  'bg-teal-500': '#14B8A6', 'bg-indigo-500': '#6366F1', 'bg-gray-500': '#6B7280',
};
const colorOptions = Object.keys(colorMap);

// Constants for Firestore and settings
const TASKS_COLLECTION_BASE_PATH = 'artifacts';
const APP_ID_PLACEHOLDER = 'crypto-airdrop-manager-mobile'; // Replace with actual app ID if dynamic
const SETTINGS_STORAGE_KEY = 'airdrop-app-settings'; // AsyncStorage key for general app settings

interface FormStep {
    id: string;
    title: string;
    order: number;
    // Retain description and isCompleted if needed for editing, though typically reset on new task
    description?: string;
    isCompleted?: boolean;
}

type AddTaskRouteProp = RouteProp<RootStackParamList, 'AddTask'>;
type AddTaskNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddTask'>;

const AddTaskScreen = () => {
  const navigation = useNavigation<AddTaskNavigationProp>();
  const route = useRoute<AddTaskRouteProp>();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const taskIdToEdit = route.params?.taskIdToEdit;
  const isEditMode = !!taskIdToEdit;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [interval, setInterval] = useState<AirdropTask['interval']>('daily');
  const [category, setCategory] = useState('DeFi');
  const [priority, setPriority] = useState<AirdropTask['priority']>('medium');
  const [formSteps, setFormSteps] = useState<FormStep[]>([{ id: `new-${Date.now()}`, title: '', order: 1 }]);
  const [selectedColor, setSelectedColor] = useState<string>(colorOptions[0]);
  const [nextDueDate, setNextDueDate] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [originalTask, setOriginalTask] = useState<AirdropTask | null>(null);
  const [enableNotificationsSetting, setEnableNotificationsSetting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get tasks collection path for the current user
  const getTasksCollectionPathForUser = useCallback(() => {
    if (!userId) return null;
    const appId = typeof __app_id !== 'undefined' ? __app_id : APP_ID_PLACEHOLDER;
    return `${TASKS_COLLECTION_BASE_PATH}/${appId}/users/${userId}/airdropTasks_mobile`;
  }, [userId]);

  // Effect for Firebase Auth state
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      if (currentUser) {
        setUserId(currentUser.uid);
      } else {
        setUserId(null);
        // If user gets logged out while on this screen, navigate away or show an error
        Alert.alert("Authentication Error", "You have been signed out. Please sign in again to manage tasks.", [{ text: "OK", onPress: () => navigation.navigate('TaskList') }]);
      }
    });
    return subscriber;
  }, [navigation]);


  // Load notification settings from AsyncStorage
  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const settingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (settingsString) {
          const settings = JSON.parse(settingsString);
          setEnableNotificationsSetting(settings.enableNotifications || false);
        }
      } catch (error) {
        console.error("AddTaskScreen: Failed to load notification settings", error);
      }
    };
    loadNotificationSettings();
  }, []);

  // Load task for editing from Firestore
  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? 'Edit Task' : 'Add New Task',
    });

    if (isEditMode && taskIdToEdit && userId) {
      setIsLoading(true);
      const tasksCollectionPath = getTasksCollectionPathForUser();
      if (!tasksCollectionPath) {
          setIsLoading(false);
          Alert.alert("Error", "User not identified. Cannot load task.");
          navigation.goBack();
          return;
      }

      const docRef = firestore().collection(tasksCollectionPath).doc(taskIdToEdit);
      docRef.get().then(doc => {
        if (doc.exists) {
          const taskData = doc.data() as any; // Cast to any or a Firestore-specific type
          const taskToEdit: AirdropTask = {
            id: doc.id,
            ...taskData,
            lastCompleted: taskData.lastCompleted ? taskData.lastCompleted.toDate() : null,
            nextDue: taskData.nextDue.toDate(),
          };
          setOriginalTask(taskToEdit);
          setName(taskToEdit.name);
          setDescription(taskToEdit.description);
          setInterval(taskToEdit.interval);
          setCategory(taskToEdit.category);
          setPriority(taskToEdit.priority);
          setFormSteps(taskToEdit.steps.map(s => ({ id: s.id, title: s.title, order: s.order, description: s.description, isCompleted: s.isCompleted })));
          setSelectedColor(taskToEdit.color || colorOptions[0]);
          setNextDueDate(new Date(taskToEdit.nextDue)); // Ensure it's a JS Date
          setIsActive(taskToEdit.isActive);
        } else {
          Alert.alert('Error', 'Task to edit not found in Firestore.');
          navigation.goBack();
        }
      }).catch(error => {
        console.error("Failed to load task for editing from Firestore:", error);
        Alert.alert('Error', 'Could not load task details for editing.');
        navigation.goBack();
      }).finally(() => {
        setIsLoading(false);
      });
    } else if (!isEditMode) { // For new tasks, calculate initial due date
        setNextDueDate(calculateNextDueDateHelper(new Date(), interval, true));
    }
  }, [isEditMode, taskIdToEdit, userId, navigation, getTasksCollectionPathForUser]); // Added getTasksCollectionPathForUser

  // Step input handlers (remain the same)
  const handleStepTitleChange = (text: string, index: number) => {
    const newFormSteps = [...formSteps];
    newFormSteps[index].title = text;
    setFormSteps(newFormSteps);
  };
  const addStepInput = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setFormSteps([...formSteps, { id: `new-${Date.now()}-${formSteps.length}`, title: '', order: formSteps.length + 1 }]);
  };
  const removeStepInput = (index: number) => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    if (formSteps.length > 1 || (formSteps.length === 1 && formSteps[0].title !== '')) {
      const newFormSteps = formSteps.filter((_, i) => i !== index).map((step, idx) => ({...step, order: idx + 1}));
      if (newFormSteps.length === 0) {
          setFormSteps([{id: `new-${Date.now()}`, title: '', order: 1}]);
      } else {
          setFormSteps(newFormSteps);
      }
    } else if (formSteps.length === 1 && formSteps[0].title !== '') {
        setFormSteps([{...formSteps[0], title: ''}]);
    }
  };
  
  // Due date calculation and picker handlers (remain largely the same)
  const calculateNextDueDateHelper = (startDate: Date, taskInterval: AirdropTask['interval'], isNewTask: boolean, currentNextDue?: Date): Date => {
    let baseDate = currentNextDue ? new Date(currentNextDue) : new Date(startDate);
    
    if (isNewTask || !originalTask?.lastCompleted || (isEditMode && !originalTask?.lastCompleted)) {
        if (taskInterval !== 'hourly') {
            baseDate = new Date(); 
            baseDate.setHours(nextDueDate.getHours(), nextDueDate.getMinutes(), 0, 0); 
            if (taskInterval === 'daily') baseDate.setDate(baseDate.getDate() + 1);
            else if (taskInterval === 'weekly') baseDate.setDate(baseDate.getDate() + 7);
            else if (taskInterval === 'biweekly') baseDate.setDate(baseDate.getDate() + 14);
        } else {
            baseDate = new Date();
            baseDate.setMinutes(0,0,0);
            baseDate.setHours(baseDate.getHours() + 1);
        }
    } else if (originalTask?.lastCompleted) { 
        baseDate = new Date(originalTask.lastCompleted);
         if (taskInterval !== 'hourly') baseDate.setHours(0,0,0,0); 
        switch (taskInterval) {
            case 'hourly': baseDate.setHours(baseDate.getHours() + 1); break;
            case 'daily': baseDate.setDate(baseDate.getDate() + 1); break;
            case 'weekly': baseDate.setDate(baseDate.getDate() + 7); break;
            case 'biweekly': baseDate.setDate(baseDate.getDate() + 14); break;
        }
    }
    return baseDate;
  };
  useEffect(() => {
      if (!isEditMode || (isEditMode && originalTask && originalTask.interval !== interval)) {
          setNextDueDate(calculateNextDueDateHelper(new Date(), interval, !isEditMode, isEditMode ? nextDueDate : undefined));
      }
  }, [interval, isEditMode, originalTask]);
  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const currentDate = selectedDate;
      const newDateWithOriginalTime = new Date(nextDueDate);
      newDateWithOriginalTime.setFullYear(currentDate.getFullYear());
      newDateWithOriginalTime.setMonth(currentDate.getMonth());
      newDateWithOriginalTime.setDate(currentDate.getDate());
      setNextDueDate(newDateWithOriginalTime);
      if (Platform.OS !== 'ios') {
          setShowTimePicker(true);
      }
    }
  };
  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
        const newTime = new Date(nextDueDate);
        newTime.setHours(selectedTime.getHours());
        newTime.setMinutes(selectedTime.getMinutes());
        newTime.setSeconds(0);
        newTime.setMilliseconds(0);
        setNextDueDate(newTime);
    }
  };

  // Save Task to Firestore
  const handleSaveTask = async () => {
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
    if (!userId) {
      Alert.alert("Error", "User not authenticated. Cannot save task.");
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Task name is required.');
      return;
    }
    const filledFormSteps = formSteps.filter(step => step.title.trim() !== "");
    if (formSteps.length > filledFormSteps.length && filledFormSteps.length > 0) {
         Alert.alert('Validation Error', 'All step fields must be filled, or remove empty step inputs.');
         return;
    }
    setIsLoading(true);

    const tasksCollectionPath = getTasksCollectionPathForUser();
    if (!tasksCollectionPath) {
        setIsLoading(false);
        Alert.alert("Error", "Cannot determine where to save the task. User path is missing.");
        return;
    }

    const taskStepsToSave: TaskStep[] = filledFormSteps.map((formStep, index) => ({
        id: formStep.id.startsWith('new-') ? `${firestore().collection('tmp').doc().id}` : formStep.id, // Generate new ID for new steps
        title: formStep.title.trim(),
        description: formStep.description || '', // Preserve existing description if editing step
        isCompleted: formStep.isCompleted || false, // Preserve existing completion if editing step
        order: index + 1,
    }));

    let taskDataForFirestore: any; // Use 'any' or a Firestore-specific type for Timestamps
    let taskForNotificationScheduling: AirdropTask; // For passing to scheduleNotification
    let newNotificationId: number | null = null;

    if (isEditMode && originalTask) {
      taskDataForFirestore = {
        name: name.trim(),
        description: description.trim(),
        interval,
        steps: taskStepsToSave,
        category,
        priority,
        color: selectedColor,
        nextDue: firestore.Timestamp.fromDate(nextDueDate), // Convert to Firestore Timestamp
        isActive,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        // Retain original streak, lastCompleted, createdAt, notificationId unless explicitly changed
        streak: originalTask.streak,
        lastCompleted: originalTask.lastCompleted ? firestore.Timestamp.fromDate(originalTask.lastCompleted) : null,
        createdAt: originalTask.createdAt ? firestore.Timestamp.fromDate(originalTask.createdAt) : firestore.FieldValue.serverTimestamp(), // Should exist
        notificationId: originalTask.notificationId, // Keep existing, will be updated by notification logic
      };
      taskForNotificationScheduling = { ...originalTask, ...taskDataForFirestore, nextDue: nextDueDate, id: originalTask.id };

      if (originalTask.notificationId) {
          cancelTaskNotification(originalTask.id); // Cancel based on task ID
      }
      if (taskForNotificationScheduling.isActive && enableNotificationsSetting && taskForNotificationScheduling.nextDue.getTime() > Date.now()) {
        newNotificationId = scheduleNotification(taskForNotificationScheduling, taskForNotificationScheduling.nextDue, true);
      }
      taskDataForFirestore.notificationId = newNotificationId ?? null; // Firestore prefers null over undefined

    } else { // New task
      const newTaskId = firestore().collection(tasksCollectionPath).doc().id; // Generate ID upfront for notification consistency
      taskDataForFirestore = {
        name: name.trim(),
        description: description.trim(),
        interval,
        steps: taskStepsToSave.map(s => ({...s, id: s.id.startsWith('new-') ? `${newTaskId}-step-${s.order}`: s.id})), // Ensure step IDs are unique if needed
        streak: 0,
        lastCompleted: null,
        nextDue: firestore.Timestamp.fromDate(nextDueDate),
        isActive: true,
        category,
        priority,
        color: selectedColor,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        userId: userId, // Associate task with user
        notificationId: null, // Initially null
      };
      taskForNotificationScheduling = { id: newTaskId, ...taskDataForFirestore, nextDue: nextDueDate, lastCompleted: null, streak: 0 }; // For notification func

      if (taskForNotificationScheduling.isActive && enableNotificationsSetting && taskForNotificationScheduling.nextDue.getTime() > Date.now()) {
        newNotificationId = scheduleNotification(taskForNotificationScheduling, taskForNotificationScheduling.nextDue, true);
      }
      taskDataForFirestore.notificationId = newNotificationId ?? null;
    }

    try {
      if (isEditMode && taskIdToEdit) {
        await firestore().collection(tasksCollectionPath).doc(taskIdToEdit).update(taskDataForFirestore);
        console.log("AddTaskScreen: Task updated in Firestore:", taskIdToEdit);
      } else {
        // For new tasks, use the pre-generated ID for the document
        await firestore().collection(tasksCollectionPath).doc(taskForNotificationScheduling.id).set(taskDataForFirestore);
        console.log("AddTaskScreen: New task added to Firestore:", taskForNotificationScheduling.id);
      }
      // Navigate back to TaskList; Firestore listener there will update the UI.
      navigation.navigate('TaskList', { refresh: true }); // Trigger refresh just in case, though listener should handle it
    } catch (e) {
      console.error(`AddTaskScreen: Failed to ${isEditMode ? 'update' : 'save'} task in Firestore:`, e);
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'save'} the task. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Theme styles (remain the same)
  const themeStyles = {
    containerBg: isDarkMode ? '#1F2937' : '#FFFFFF',
    labelColor: isDarkMode ? '#D1D5DB' : '#374151',
    inputBg: isDarkMode ? '#374151' : '#F3F4F6',
    inputText: isDarkMode ? '#E5E7EB' : '#1F2937',
    inputBorder: isDarkMode ? '#4B5563' : '#D1D5DB',
    placeholderText: isDarkMode ? '#9CA3AF' : '#6B7280',
    pickerButtonBg: isDarkMode ? '#2D3748' : '#E2E8F0',
    pickerButtonSelectedBg: isDarkMode ? '#4A5568' : '#CBD5E0',
    pickerButtonText: isDarkMode ? '#E2E8F0' : '#1A202C',
    addStepButtonBorder: isDarkMode ? '#60A5FA' : '#2563EB',
    addStepButtonText: isDarkMode ? '#60A5FA' : '#2563EB',
    saveButtonBg: isDarkMode ? (isEditMode ? '#2563EB' : '#2B6CB0') : (isEditMode ? '#1D4ED8' : '#3182CE'),
    loaderColor: isDarkMode ? '#FFFFFF' : '#1D4ED8',
    colorOptionSelectedBorder: isDarkMode ? '#E2E8F0' : '#1A202C',
    datePickerButtonText: isDarkMode ? '#60A5FA' : '#2563EB',
    switchThumbColor: Platform.OS === 'android' ? (isDarkMode ? '#A0AEC0' : '#FFFFFF') : undefined, // For isActive Switch
    switchTrackColor: { false: isDarkMode ? '#4A5568' : '#E2E8F0', true: isDarkMode ? '#38A169' : '#48BB78' }, // For isActive Switch
  };

  const inputStyle = [styles.input, { backgroundColor: themeStyles.inputBg, color: themeStyles.inputText, borderColor: themeStyles.inputBorder }];
  const labelStyle = [styles.label, { color: themeStyles.labelColor }];

  // Loading UI for edit mode
  if (isLoading && isEditMode && !name) { // Show loader if fetching task data for edit
      return (
          <View style={[styles.loaderContainer, {backgroundColor: themeStyles.containerBg}]}>
              <ActivityIndicator size="large" color={themeStyles.loaderColor} />
              <Text style={{color: themeStyles.placeholderText, marginTop: 10}}>Loading task for editing...</Text>
          </View>
      );
  }
  
  if (!userId && !isLoading) { // If no user and not loading (e.g., auth state changed)
      return (
          <View style={[styles.loaderContainer, {backgroundColor: themeStyles.containerBg}]}>
              <Text style={{color: themeStyles.placeholderText, marginTop: 10, textAlign: 'center'}}>
                  User not authenticated. Please sign in to add or edit tasks.
              </Text>
          </View>
      );
  }


  return (
    <ScrollView 
        style={[styles.container, { backgroundColor: themeStyles.containerBg }]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }} >
      <View style={styles.form}>
        <Text style={labelStyle}>Task Name*</Text>
        <TextInput style={inputStyle} placeholder="E.g., Daily ZkSync Interaction" placeholderTextColor={themeStyles.placeholderText} value={name} onChangeText={setName} />

        <Text style={labelStyle}>Description</Text>
        <TextInput style={[inputStyle, styles.textArea]} placeholder="Any specific details or links" placeholderTextColor={themeStyles.placeholderText} value={description} onChangeText={setDescription} multiline numberOfLines={3} />

        {isEditMode && ( // Show Active toggle only in edit mode
            <View style={styles.activeToggleContainer}>
                <Text style={labelStyle}>Task Active</Text>
                <Switch
                    trackColor={themeStyles.switchTrackColor}
                    thumbColor={isActive ? (Platform.OS === 'ios' ? '#FFFFFF' : (isDarkMode ? '#38A169' : '#48BB78')) : themeStyles.switchThumbColor}
                    ios_backgroundColor={themeStyles.switchTrackColor.false}
                    onValueChange={(value) => {
                        ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                        setIsActive(value);
                    }}
                    value={isActive}
                />
            </View>
        )}

        <Text style={labelStyle}>Next Due Date & Time</Text>
        <TouchableOpacity onPress={() => { ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); setShowDatePicker(true);}} style={[inputStyle, styles.dateDisplayButton]}>
            <Text style={{color: themeStyles.inputText}}>{nextDueDate.toLocaleString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
        </TouchableOpacity>
        {showDatePicker && (
            <DateTimePicker testID="datePicker" value={nextDueDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} minimumDate={new Date()} />
        )}
        {showTimePicker && (
             <DateTimePicker testID="timePicker" value={nextDueDate} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTimeChange} />
        )}

        <Text style={labelStyle}>Interval</Text>
        <View style={styles.pickerContainer}>
          {['hourly', 'daily', 'weekly', 'biweekly'].map((int) => (
            <TouchableOpacity key={int} style={[styles.pickerButton, {backgroundColor: interval === int ? themeStyles.pickerButtonSelectedBg : themeStyles.pickerButtonBg}, interval === int && styles.pickerButtonSelected(isDarkMode)]} onPress={() => {ReactNativeHapticFeedback.trigger("selection", hapticOptions); setInterval(int as AirdropTask['interval']);}} >
              <Text style={[styles.pickerButtonText, {color: themeStyles.pickerButtonText}]}>{int.charAt(0).toUpperCase() + int.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Category</Text>
        <TextInput style={inputStyle} placeholder="E.g., DeFi, NFT, Bridge" placeholderTextColor={themeStyles.placeholderText} value={category} onChangeText={setCategory} />
        
        <Text style={labelStyle}>Priority</Text>
        <View style={styles.pickerContainer}>
          {['low', 'medium', 'high'].map((p) => (
            <TouchableOpacity key={p} style={[styles.pickerButton, {backgroundColor: priority === p ? themeStyles.pickerButtonSelectedBg : themeStyles.pickerButtonBg}, priority === p && styles.pickerButtonSelected(isDarkMode)]} onPress={() => {ReactNativeHapticFeedback.trigger("selection", hapticOptions); setPriority(p as AirdropTask['priority']);}} >
              <Text style={[styles.pickerButtonText, {color: themeStyles.pickerButtonText}]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Task Color</Text>
        <View style={styles.colorPickerContainer}>
            {colorOptions.map(colorKey => (
                <TouchableOpacity key={colorKey} style={[styles.colorOption, { backgroundColor: colorMap[colorKey] }, selectedColor === colorKey && styles.colorOptionSelected(themeStyles.colorOptionSelectedBorder)]} onPress={() => {ReactNativeHapticFeedback.trigger("selection", hapticOptions); setSelectedColor(colorKey);}} />
            ))}
        </View>

        <Text style={labelStyle}>Steps</Text>
        {formSteps.map((step, index) => (
          <View key={step.id} style={styles.stepInputContainer}>
            <TextInput style={[inputStyle, styles.stepInput]} placeholder={`Step ${index + 1} title`} placeholderTextColor={themeStyles.placeholderText} value={step.title} onChangeText={(text) => handleStepTitleChange(text, index)} />
            { (formSteps.length > 1 || (formSteps.length === 1 && formSteps[0].title !== '')) &&
              <TouchableOpacity onPress={() => removeStepInput(index)} style={styles.removeStepButton}>
                <Text style={styles.removeStepButtonText}>✕</Text>
              </TouchableOpacity>
            }
          </View>
        ))}
        <TouchableOpacity onPress={addStepInput} style={styles.addStepButton(themeStyles.addStepButtonBorder)}>
          <Text style={[styles.addStepButtonText, {color: themeStyles.addStepButtonText}]}>+ Add Step</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveButton, {backgroundColor: themeStyles.saveButtonBg}]} onPress={handleSaveTask} disabled={isLoading || !userId} >
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{isEditMode ? 'Update Task' : 'Create Task'}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Styles (remain the same)
const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { padding: 20 },
  label: { fontSize: 15, fontWeight: '500', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, borderRadius: 8, fontSize: 16, marginBottom: 10 },
  activeToggleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 5, paddingVertical: 5 },
  dateDisplayButton: { justifyContent: 'center', minHeight: Platform.OS === 'ios' ? 44 : 48 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  pickerButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1.5, borderColor: 'transparent', marginRight: 8, marginBottom: 8 },
  pickerButtonSelected: (isCurrentlyDarkMode: boolean) => ({ borderColor: isCurrentlyDarkMode ? '#60A5FA' : '#2563EB' }),
  pickerButtonText: { fontSize: 14, fontWeight: '500' },
  colorPickerContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 10 },
  colorOption: { width: 30, height: 30, borderRadius: 15, margin: 5, borderWidth: 2, borderColor: 'transparent' },
  colorOptionSelected: (borderColor: string) => ({ borderColor: borderColor, transform: [{scale: 1.15}]}),
  stepInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepInput: { flex: 1, marginRight: 8 },
  removeStepButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  removeStepButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', lineHeight: 14 },
  addStepButton: (borderColor: string) => ({ paddingVertical: 10, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: borderColor, borderStyle: 'dashed', marginTop: 5, marginBottom: 20 }),
  addStepButtonText: { fontSize: 15, fontWeight: '500' },
  saveButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});

export default AddTaskScreen;
