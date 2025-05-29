// File: project-root/mobile/screens/SettingsScreen.tsx
// Description: Manages application settings, including theme, notification preferences,
// data management (clear data, import/export with document picker), and user sign-out.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  Share, 
  // TextInput, // No longer needed for JSON paste
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import PushNotification from 'react-native-push-notification'; 
import PushNotificationIOS from '@react-native-community/push-notification-ios';

// Firebase
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// Document Picker (Simulated - requires installation and linking)
// import DocumentPicker, { DocumentPickerResponse, types as DocumentPickerTypes } from 'react-native-document-picker';
// For simulation, we'll define placeholder types if the import fails in this environment
let DocumentPicker: any = null;
let DocumentPickerTypes: any = { json: 'application/json' }; // Default type
try {
    DocumentPicker = require('react-native-document-picker').default;
    DocumentPickerTypes = require('react-native-document-picker').types;
} catch (e) {
    console.warn("react-native-document-picker not found. Import functionality will be limited to simulation.");
}


// Import shared types
import type { RootStackParamList, AirdropTask, TaskStep, AirdropTaskFirestore } from '../types';
// Import Theme context
import { useTheme, ThemePreference } from '../ThemeContext';
// Import NotificationManager functions
import { scheduleNotification, cancelTaskNotification, cancelAllNotifications } from '../NotificationManager';
// Import Firestore helper
import { getTasksCollectionPathForUser } from '../utils/firestoreHelper'; 


// Constants
const SETTINGS_STORAGE_KEY = 'airdrop-app-settings';
const TASK_LIST_SETTINGS_KEY = 'airdrop-task-list-settings-v2'; 
const APP_VERSION = "1.0.3"; 

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface AppSettings {
  enableNotifications: boolean;
  theme: ThemePreference; 
}

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [enableNotificationsLocal, setEnableNotificationsLocal] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const [isProcessingData, setIsProcessingData] = useState(false); 
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notificationsGloballyEnabled, setNotificationsGloballyEnabled] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  // const [importJsonText, setImportJsonText] = useState(''); // No longer needed
  // const [showImportTextArea, setShowImportTextArea] = useState(false); // No longer needed
  const current_app_id = typeof __app_id !== 'undefined' ? __app_id : undefined;


  // Auth state listener
  useEffect(() => { /* ... as before ... */ });
  // Load settings from AsyncStorage
  const loadSettings = useCallback(async () => { /* ... as before ... */ }, [setThemePreference]);
  useEffect(() => { loadSettings(); }, [loadSettings]);
  // Update all task notifications
  const updateAllTaskNotifications = async (newEnableNotificationsSetting: boolean) => { /* ... as before ... */ };
  // Handle notification toggle
  const handleEnableNotificationsToggle = async (value: boolean) => { /* ... as before ... */ };
  // Handle theme change
  const handleThemeChange = (newPreference: ThemePreference) => { /* ... as before ... */ };
  // Handle clearing all task data from Firestore
  const handleClearAllTaskData = () => { /* ... as before ... */ };
  // Handle sign out
  const handleSignOut = async () => { /* ... as before ... */ };
  // Open system app settings
  const openAppSettingsSystem = () => { Linking.openSettings(); };
  // Handle help and support action
  const handleHelpAndSupport = async () => { /* ... as before ... */ };
  // Handle export data
  const handleExportData = async () => { /* ... as before ... */ };


  const processImportData = async (jsonString: string) => {
    const tasksCollectionPath = getTasksCollectionPathForUser(userId, current_app_id);
    if (!userId || !tasksCollectionPath) {
      Alert.alert("Error", "Sign in to import data.");
      return;
    }
    if (!jsonString.trim()) {
      Alert.alert("No Data", "The selected file is empty or contains no valid JSON.");
      return;
    }
    setIsProcessingData(true);
    try {
      const importedTasksRaw = JSON.parse(jsonString);
      if (!Array.isArray(importedTasksRaw)) {
        throw new Error("Invalid file format: Expected an array of tasks.");
      }

      const batch = firestore().batch();
      let importCount = 0;

      for (const task of importedTasksRaw) {
        if (!task.name || typeof task.name !== 'string') {
          console.warn("Skipping task due to missing/invalid name:", task);
          continue;
        }
        const firestoreTaskData: Partial<AirdropTaskFirestore> & { userId: string } = {
          name: task.name,
          description: task.description || "",
          interval: ['hourly', 'daily', 'weekly', 'biweekly'].includes(task.interval) ? task.interval : "daily",
          steps: Array.isArray(task.steps) ? task.steps.map((s: any, i: number) => ({
            id: s.id || `${firestore().collection('_').doc().id}`, 
            title: s.title || "Step",
            description: s.description || "",
            isCompleted: !!s.isCompleted,
            order: s.order || i + 1
          })) : [],
          streak: Number(task.streak) || 0,
          lastCompleted: task.lastCompleted ? firestore.Timestamp.fromDate(new Date(task.lastCompleted)) : null,
          nextDue: task.nextDue ? firestore.Timestamp.fromDate(new Date(task.nextDue)) : firestore.Timestamp.now(),
          isActive: typeof task.isActive === 'boolean' ? task.isActive : true,
          category: task.category || "DeFi",
          priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : "medium",
          color: task.color || 'bg-blue-500', 
          userId: userId,
          createdAt: task.createdAt ? firestore.Timestamp.fromDate(new Date(task.createdAt)) : firestore.Timestamp.now(),
          updatedAt: task.updatedAt ? firestore.Timestamp.fromDate(new Date(task.updatedAt)) : firestore.Timestamp.now(),
          notificationId: null, 
        };

        const docRef = task.id && typeof task.id === 'string' 
          ? firestore().collection(tasksCollectionPath).doc(task.id)
          : firestore().collection(tasksCollectionPath).doc(); 
        
        batch.set(docRef, firestoreTaskData, { merge: true }); 
        importCount++;
      }

      await batch.commit();
      Alert.alert("Import Successful", `Successfully imported/updated ${importCount} tasks!`);
      updateAllTaskNotifications(enableNotificationsLocal); 
      navigation.navigate('TaskList', { refresh: true });
    } catch (error: any) {
      console.error("SettingsScreen: Import failed:", error);
      Alert.alert("Import Failed", error.message || "Could not import tasks. Check JSON format and content.");
    } finally {
      setIsProcessingData(false);
    }
  };

  const handleImportFromFile = async () => {
    if (!DocumentPicker) {
        Alert.alert("Feature Not Available", "Document picker is not available in this environment. Please ensure 'react-native-document-picker' is installed and linked.");
        return;
    }
    if (!userId) {
        Alert.alert("Authentication Required", "Please sign in to import data.");
        return;
    }

    setIsProcessingData(true);
    try {
      const pickerResultArray = await DocumentPicker.pick({
        type: [DocumentPickerTypes.json], // Allow only JSON files
        copyTo: 'cachesDirectory', // Recommended for iOS to access the file
      });

      // react-native-document-picker v8+ returns an array, even for single pick
      const pickerResult = pickerResultArray[0];

      if (pickerResult && pickerResult.uri) {
        const fileUri = Platform.OS === 'ios' ? pickerResult.uri.replace('file://', '') : pickerResult.uri;
        
        // RNFS would be ideal here for robust file reading. Simulating with fetch for non-critical path.
        // For actual implementation, use react-native-fs:
        // import RNFS from 'react-native-fs';
        // const fileContent = await RNFS.readFile(fileUri, 'utf8');
        
        // --- SIMULATED FILE READ ---
        // This is a placeholder. In a real app, use react-native-fs.
        // For this simulation, we'll assume a way to get content.
        // If pickerResult.fileCopyUri is available and accessible, it might be used.
        // Let's prompt for paste as a fallback if direct read isn't simple to simulate.
        console.log("File picked:", pickerResult.name, pickerResult.uri);
        Alert.prompt(
            "Paste File Content (Simulation)",
            `File "${pickerResult.name}" selected. For this simulation, please paste its JSON content here. In a real app, this would be read automatically.`,
            [
                { text: "Cancel", style: "cancel", onPress: () => setIsProcessingData(false) },
                { text: "Import", onPress: (text) => {
                    if (text) {
                        processImportData(text);
                    } else {
                        Alert.alert("No Content", "No JSON content was provided.");
                        setIsProcessingData(false);
                    }
                }}
            ],
            "plain-text"
        );
        // --- END OF SIMULATED FILE READ ---
        
        // Actual logic would be:
        // const RNFS = require('react-native-fs'); // Would need to be imported
        // const jsonString = await RNFS.readFile(fileUri, 'utf8');
        // await processImportData(jsonString);

      } else {
        Alert.alert("Import Cancelled", "No file was selected for import.");
        setIsProcessingData(false);
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled the document picker.');
      } else {
        console.error('Error picking document:', err);
        Alert.alert('Import Error', 'Could not pick or read the file.');
      }
      setIsProcessingData(false);
    }
  };


  const handleClearLocalAppSettings = () => { /* ... as before ... */ };


  // Theme-dependent styles
  const cardBg = isDarkMode ? '#2D3748' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#E2E8F0' : '#1A202C';
  const textSecondary = isDarkMode ? '#A0AEC0' : '#4A5568';
  const switchThumbColor = Platform.OS === 'android' ? (isDarkMode ? '#A0AEC0' : '#FFFFFF') : undefined;
  const switchTrackColor = { false: isDarkMode ? '#4A5568' : '#E2E8F0', true: isDarkMode ? '#38A169' : '#48BB78' };
  const activeThemeButtonBg = isDarkMode ? '#4A5568' : '#CBD5E0';
  const inactiveThemeButtonBg = isDarkMode ? '#2D3748' : '#E2E8F0';
  const destructiveButtonColor = isDarkMode ? '#FCA5A5' : '#EF4444'; 
  const destructiveButtonTextColor = isDarkMode ? '#7F1D1D' : '#FFFFFF'; 
  const primaryActionColor = isDarkMode ? '#60A5FA' : '#2563EB';
  // const inputBg = isDarkMode ? '#1F2937' : '#F3F4F6'; // No longer needed for JSON paste
  // const inputBorder = isDarkMode ? '#4B5563' : '#D1D5DB'; // No longer needed
  // const inputText = isDarkMode ? '#E2E8F0' : '#1A202C'; // No longer needed


  if (isLoading && !userId) { 
      return ( <View style={[styles.loaderContainer, { backgroundColor: isDarkMode ? '#1A202C' : '#F7FAFC'}]}><ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#1D4ED8'} /><Text style={{color: textSecondary, marginTop: 10}}>Loading Settings...</Text></View> );
  }
  if (!userId && !isLoading) { 
      return ( <View style={[styles.loaderContainer, { backgroundColor: isDarkMode ? '#1A202C' : '#F7FAFC'}]}><Text style={{color: textSecondary, marginTop: 10, textAlign: 'center', paddingHorizontal: 20}}>Please sign in to access settings.</Text><TouchableOpacity onPress={() => navigation.navigate('Auth')} style={[styles.signInButton, {backgroundColor: primaryActionColor}]}><Text style={styles.signInButtonText}>Go to Sign In</Text></TouchableOpacity></View> );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#1A202C' : '#F7FAFC' }]}>
      {/* Appearance Section */}
      <View style={styles.section}>
        {/* ... Theme settings UI ... */}
      </View>

      {/* General Section (Notifications) */}
      <View style={styles.section}>
        {/* ... Notification settings UI ... */}
      </View>

      {/* Data Management Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Data Management</Text>
         <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: cardBg, opacity: (isProcessingData || isSigningOut) ? 0.5 : 1 }]}
            onPress={handleExportData} 
            disabled={isProcessingData || isSigningOut} >
            {isProcessingData ? <ActivityIndicator color={primaryActionColor} size="small" />
            : <Text style={[styles.settingTextAction, { color: primaryActionColor }]}>Export Task Data</Text>}
        </TouchableOpacity>
         <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: cardBg, marginTop:1, opacity: (isProcessingData || isSigningOut) ? 0.5 : 1 }]}
            onPress={handleImportFromFile} // Changed to call document picker
            disabled={isProcessingData || isSigningOut} >
           <Text style={[styles.settingTextAction, { color: primaryActionColor }]}>Import Task Data from File</Text>
        </TouchableOpacity>

        {/* Removed TextInput for JSON paste */}

        <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: isDarkMode ? '#374151' : '#E2E8F0' , marginTop: 1, opacity: (isProcessingData || isSigningOut) ? 0.5 : 1 }]}
            onPress={handleClearLocalAppSettings}
            disabled={isProcessingData || isSigningOut} >
            <Text style={[styles.settingTextAction, { color: textPrimary }]}>Clear Local App Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: isDarkMode ? '#522121' : '#FEE2E2' , marginTop: 1, opacity: (isProcessingData || isSigningOut) ? 0.5 : 1 }]}
            onPress={handleClearAllTaskData}
            disabled={isProcessingData || isSigningOut} >
            {isProcessingData ? <ActivityIndicator color={destructiveButtonColor} size="small" />
            : <Text style={[styles.settingTextAction, { color: destructiveButtonColor }]}>Clear All My Task Data (Cloud)</Text>}
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        {/* ... Account settings UI ... */}
      </View>

      {/* About Section */}
      <View style={styles.section}>
        {/* ... About section UI ... */}
      </View>
      <View style={{height: 30}} />
    </ScrollView>
  );
};

// Styles (Removed styles related to importTextArea, importHeader, etc.)
const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '500', paddingHorizontal: 16, marginBottom: 10, textTransform: 'uppercase', opacity: 0.7 },
  settingItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 12, borderRadius: 10, marginBottom: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  permissionWarningContainer: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6 },
  permissionWarningText: { fontSize: 13, marginBottom: 4},
  permissionLink: { fontSize: 13, fontWeight: 'bold'},
  settingItemButton: { paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: 12, borderRadius: 10, marginBottom: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1, justifyContent: 'center', alignItems: 'center', minHeight: 50 },
  settingText: { fontSize: 16 },
  subSettingText: { fontSize: 13, marginTop: 2, opacity: 0.8 },
  settingTextAction: { fontSize: 16, fontWeight: '500' },
  themeSelectorContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 5 },
  themeButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 5, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', marginHorizontal: 4 },
  themeButtonSelected: (isCurrentlyDark: boolean) => ({ borderColor: isCurrentlyDark ? '#60A5FA' : '#2563EB', borderWidth: 1.5 }),
  themeButtonText: { fontSize: 14, fontWeight: '500' },
  signInButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 20, alignItems: 'center' },
  signInButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  // Removed: importContainer, importHeader, clearImportButton, clearImportButtonText, importTextArea, importInstructionText, processImportButton
  buttonText: { // Kept for general button text if needed, e.g., on processImportButton if it were still there
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
  }
});

export default SettingsScreen;
