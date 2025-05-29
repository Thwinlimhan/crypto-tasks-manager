// File: project-root/mobile/screens/AddTaskScreen.tsx
// Description: This screen allows users to add new airdrop tasks or edit existing ones,
// now integrated with Firebase Firestore for data persistence.
// Added support for step descriptions.

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
  Switch,
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
// Import Firestore helper
import { getTasksCollectionPathForUser } from '../utils/firestoreHelper'; 

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Color mapping
const colorMap: { [key: string]: string } = {
  'bg-blue-500': '#3B82F6', 'bg-purple-500': '#8B5CF6', 'bg-green-500': '#10B981',
  'bg-red-500': '#EF4444', 'bg-yellow-500': '#F59E0B', 'bg-pink-500': '#EC4899',
  'bg-teal-500': '#14B8A6', 'bg-indigo-500': '#6366F1', 'bg-gray-500': '#6B7280',
};
const colorOptions = Object.keys(colorMap);

// Constants for settings
const SETTINGS_STORAGE_KEY = 'airdrop-app-settings'; 

interface FormStep {
    id: string;
    title: string;
    description: string; // Added description
    order: number;
    isCompleted?: boolean; // Typically false on creation/edit form
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
  const [formSteps, setFormSteps] = useState<FormStep[]>([{ id: `new-${Date.now()}`, title: '', description: '', order: 1 }]);
  const [selectedColor, setSelectedColor] = useState<string>(colorOptions[0]);
  const [nextDueDate, setNextDueDate] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [originalTask, setOriginalTask] = useState<AirdropTask | null>(null);
  const [enableNotificationsSetting, setEnableNotificationsSetting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const current_app_id = typeof __app_id !== 'undefined' ? __app_id : undefined;


  // Effect for Firebase Auth state
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      if (currentUser) {
        setUserId(currentUser.uid);
      } else {
        setUserId(null);
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
      const tasksCollectionPath = getTasksCollectionPathForUser(userId, current_app_id);
      if (!tasksCollectionPath) {
          setIsLoading(false);
          Alert.alert("Error", "User not identified. Cannot load task.");
          navigation.goBack();
          return;
      }

      const docRef = firestore().collection(tasksCollectionPath).doc(taskIdToEdit);
      docRef.get().then(doc => {
        if (doc.exists) {
          const taskData = doc.data() as any; 
          const taskToEdit: AirdropTask = {
            id: doc.id,
            ...taskData,
            lastCompleted: taskData.lastCompleted ? taskData.lastCompleted.toDate() : null,
            nextDue: taskData.nextDue.toDate(),
            steps: Array.isArray(taskData.steps) ? taskData.steps.sort((a: TaskStep, b: TaskStep) => a.order - b.order) : [],
          };
          setOriginalTask(taskToEdit);
          setName(taskToEdit.name);
          setDescription(taskToEdit.description);
          setInterval(taskToEdit.interval);
          setCategory(taskToEdit.category);
          setPriority(taskToEdit.priority);
          setFormSteps(taskToEdit.steps.map(s => ({ 
              id: s.id, 
              title: s.title, 
              description: s.description || '', // Ensure description is a string
              order: s.order, 
              isCompleted: s.isCompleted 
            })));
          setSelectedColor(taskToEdit.color || colorOptions[0]);
          setNextDueDate(new Date(taskToEdit.nextDue)); 
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
    } else if (!isEditMode) { 
        setNextDueDate(calculateNextDueDateHelper(new Date(), interval, true));
    }
  }, [isEditMode, taskIdToEdit, userId, navigation, current_app_id]); 

  // Step input handlers
  const handleStepInputChange = (text: string, index: number, field: 'title' | 'description') => {
    const newFormSteps = [...formSteps];
    newFormSteps[index][field] = text;
    setFormSteps(newFormSteps);
  };
  const addStepInput = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setFormSteps([...formSteps, { id: `new-${Date.now()}-${formSteps.length}`, title: '', description: '', order: formSteps.length + 1 }]);
  };
  const removeStepInput = (index: number) => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    if (formSteps.length > 1 || (formSteps.length === 1 && (formSteps[0].title !== '' || formSteps[0].description !== ''))) {
      const newFormSteps = formSteps.filter((_, i) => i !== index).map((step, idx) => ({...step, order: idx + 1}));
      if (newFormSteps.length === 0) {
          setFormSteps([{id: `new-${Date.now()}`, title: '', description: '', order: 1}]);
      } else {
          setFormSteps(newFormSteps);
      }
    } else if (formSteps.length === 1 && (formSteps[0].title !== '' || formSteps[0].description !== '')) {
        setFormSteps([{...formSteps[0], title: '', description: ''}]);
    }
  };
  
  // Due date calculation and picker handlers
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
    const tasksCollectionPath = getTasksCollectionPathForUser(userId, current_app_id);
    if (!userId || !tasksCollectionPath) {
      Alert.alert("Error", "User not authenticated or path error. Cannot save task.");
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Task name is required.');
      return;
    }
    const filledFormSteps = formSteps.filter(step => step.title.trim() !== "");
    if (formSteps.some(step => step.title.trim() === '' && step.description.trim() !== '')) {
         Alert.alert('Validation Error', 'Step description cannot be saved without a step title.');
         return;
    }
    if (formSteps.length > filledFormSteps.length && filledFormSteps.length > 0) {
        Alert.alert('Validation Error', 'Steps with content must have a title. Remove empty steps or fill their titles.');
        return;
    }
    setIsLoading(true);

    const taskStepsToSave: TaskStep[] = filledFormSteps.map((formStep, index) => ({
        id: formStep.id.startsWith('new-') ? `${firestore().collection('tmp').doc().id}` : formStep.id, 
        title: formStep.title.trim(),
        description: formStep.description.trim() || '', 
        isCompleted: formStep.isCompleted || false, 
        order: index + 1,
    }));

    let taskDataForFirestore: any; 
    let taskForNotificationScheduling: AirdropTask; 
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
        nextDue: firestore.Timestamp.fromDate(nextDueDate), 
        isActive,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        streak: originalTask.streak,
        lastCompleted: originalTask.lastCompleted ? firestore.Timestamp.fromDate(originalTask.lastCompleted) : null,
        createdAt: originalTask.createdAt ? firestore.Timestamp.fromDate(originalTask.createdAt) : firestore.FieldValue.serverTimestamp(), 
        notificationId: originalTask.notificationId, 
      };
      taskForNotificationScheduling = { ...originalTask, ...taskDataForFirestore, nextDue: nextDueDate, id: originalTask.id };

      if (originalTask.notificationId) {
          cancelTaskNotification(originalTask.id); 
      }
      if (taskForNotificationScheduling.isActive && enableNotificationsSetting && taskForNotificationScheduling.nextDue.getTime() > Date.now()) {
        newNotificationId = scheduleNotification(taskForNotificationScheduling, taskForNotificationScheduling.nextDue, true);
      }
      taskDataForFirestore.notificationId = newNotificationId ?? null; 

    } else { // New task
      const newTaskId = firestore().collection(tasksCollectionPath).doc().id; 
      taskDataForFirestore = {
        name: name.trim(),
        description: description.trim(),
        interval,
        steps: taskStepsToSave.map(s => ({...s, id: s.id.startsWith('new-') ? `${newTaskId}-step-${s.order}`: s.id})), 
        streak: 0,
        lastCompleted: null,
        nextDue: firestore.Timestamp.fromDate(nextDueDate),
        isActive: true,
        category,
        priority,
        color: selectedColor,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        userId: userId, 
        notificationId: null, 
      };
      taskForNotificationScheduling = { id: newTaskId, ...taskDataForFirestore, nextDue: nextDueDate, lastCompleted: null, streak: 0, steps: taskStepsToSave }; 

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
        await firestore().collection(tasksCollectionPath).doc(taskForNotificationScheduling.id).set(taskDataForFirestore);
        console.log("AddTaskScreen: New task added to Firestore:", taskForNotificationScheduling.id);
      }
      navigation.navigate('TaskList', { refresh: true }); 
    } catch (e) {
      console.error(`AddTaskScreen: Failed to ${isEditMode ? 'update' : 'save'} task in Firestore:`, e);
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'save'} the task. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Theme styles
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
    switchThumbColor: Platform.OS === 'android' ? (isDarkMode ? '#A0AEC0' : '#FFFFFF') : undefined, 
    switchTrackColor: { false: isDarkMode ? '#4A5568' : '#E2E8F0', true: isDarkMode ? '#38A169' : '#48BB78' }, 
  };

  const inputStyle = [styles.input, { backgroundColor: themeStyles.inputBg, color: themeStyles.inputText, borderColor: themeStyles.inputBorder }];
  const labelStyle = [styles.label, { color: themeStyles.labelColor }];

  if (isLoading && isEditMode && !name) { 
      return ( /* ... Loading UI ... */ );
  }
  if (!userId && !isLoading) { 
      return ( /* ... Signed out UI ... */ );
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

        {isEditMode && ( /* ... Active Toggle UI ... */ )}

        <Text style={labelStyle}>Next Due Date & Time</Text>
        { /* ... Date/Time Picker UI ... */ }

        <Text style={labelStyle}>Interval</Text>
        { /* ... Interval Picker UI ... */ }

        <Text style={labelStyle}>Category</Text>
        <TextInput style={inputStyle} placeholder="E.g., DeFi, NFT, Bridge" placeholderTextColor={themeStyles.placeholderText} value={category} onChangeText={setCategory} />
        
        <Text style={labelStyle}>Priority</Text>
        { /* ... Priority Picker UI ... */ }

        <Text style={labelStyle}>Task Color</Text>
        { /* ... Color Picker UI ... */ }

        <Text style={labelStyle}>Steps</Text>
        {formSteps.map((step, index) => (
          <View key={step.id} style={styles.stepItemContainer}>
            <View style={styles.stepRow}>
              <TextInput 
                style={[inputStyle, styles.stepInput, styles.stepTitleInput]} 
                placeholder={`Step ${index + 1} Title`} 
                placeholderTextColor={themeStyles.placeholderText} 
                value={step.title} 
                onChangeText={(text) => handleStepInputChange(text, index, 'title')} 
              />
              { (formSteps.length > 1 || (formSteps[0].title !== '' || formSteps[0].description !== '')) &&
                <TouchableOpacity onPress={() => removeStepInput(index)} style={styles.removeStepButton}>
                  <Text style={styles.removeStepButtonText}>✕</Text>
                </TouchableOpacity>
              }
            </View>
            <TextInput 
              style={[inputStyle, styles.stepInput, styles.stepDescriptionInput]} 
              placeholder="Step Description (optional)"
              placeholderTextColor={themeStyles.placeholderText}
              value={step.description}
              onChangeText={(text) => handleStepInputChange(text, index, 'description')}
              multiline
            />
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

// Styles
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
  stepItemContainer: { marginBottom: 12, }, // Container for title and description
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 4 : 0, }, // Row for title and remove button
  stepInput: { flex: 1, },
  stepTitleInput: { marginBottom: Platform.OS === 'ios' ? 0 : 8, marginRight: 8, }, // Title specific styles
  stepDescriptionInput: { fontSize: 14, minHeight: 50, textAlignVertical: 'top', paddingTop: 8, paddingBottom: 8 }, // Description specific
  removeStepButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', height: 38, alignSelf: 'center' },
  removeStepButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', lineHeight: 14 },
  addStepButton: (borderColor: string) => ({ paddingVertical: 10, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: borderColor, borderStyle: 'dashed', marginTop: 5, marginBottom: 20 }),
  addStepButtonText: { fontSize: 15, fontWeight: '500' },
  saveButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});

export default AddTaskScreen;
