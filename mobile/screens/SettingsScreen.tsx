// File: project-root/mobile/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
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
  Linking, // Added Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification'; // Import for notification functions
import PushNotificationIOS from '@react-native-community/push-notification-ios';


// Import shared types from ../types.ts
import type { RootStackParamList } from '../types';
// Import useTheme hook
import { useTheme, ThemePreference } from '../ThemeContext';

const SETTINGS_STORAGE_KEY = 'airdrop-app-settings';
const TASKS_STORAGE_KEY = 'airdrop-tasks-mobile-v2';
const NOTIFICATION_CHANNEL_ID = "airdrop-task-reminders"; // Match App.tsx

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface AppSettings {
  enableNotifications: boolean;
  autoSync: boolean; // Example, not used yet
  theme: ThemePreference;
}

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [appSettings, setAppSettings] = useState<Omit<AppSettings, 'theme'>>({
    enableNotifications: false,
    autoSync: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingData, setIsClearingData] = useState(false);
  const [notificationsGloballyEnabled, setNotificationsGloballyEnabled] = useState(true); // System level check

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const storedSettingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettingsString) {
          const parsedSettings = JSON.parse(storedSettingsString);
          setAppSettings({
            enableNotifications: parsedSettings.enableNotifications || false,
            autoSync: parsedSettings.autoSync || false,
          });
          // Theme is loaded by ThemeProvider
          // Check initial notification permission status
          if (Platform.OS === 'ios') {
            PushNotificationIOS.checkPermissions(permissions => {
              setNotificationsGloballyEnabled(permissions.alert || permissions.badge || permissions.sound);
            });
          } else {
            PushNotification.checkPermissions(permissions => { // This might be less reliable on Android for system settings
              setNotificationsGloballyEnabled(permissions.alert || false); // Assuming alert implies enabled
            });
          }
        }
      } catch (error) {
        console.error("SettingsScreen: Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleAppSettingChange = async (key: keyof Omit<AppSettings, 'theme'>, value: boolean) => {
    const newAppSettings = { ...appSettings, [key]: value };
    setAppSettings(newAppSettings);

    try {
      const storedSettingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      let currentSettings = { theme: themePreference };
      if (storedSettingsString) {
        currentSettings = JSON.parse(storedSettingsString);
      }
      const updatedSettings = { ...currentSettings, ...newAppSettings };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      console.log(`SettingsScreen: App setting "${key}" updated to ${value}.`);

      if (key === 'enableNotifications') {
        if (value) {
          // Request permissions if not already granted (mainly for iOS if not auto-requested)
          // Android channel is created on app start.
          if (Platform.OS === 'ios') {
             PushNotificationIOS.requestPermissions().then(perms => {
                 console.log("iOS Notification Permissions:", perms);
                 setNotificationsGloballyEnabled(perms.alert || perms.badge || perms.sound);
                 if(!(perms.alert || perms.badge || perms.sound)) {
                    Alert.alert("Permissions Needed", "Please enable notifications in your device settings for this app.");
                 }
             });
          }
          console.log("Notifications enabled in-app. Ensure system permissions are also granted.");
          // Actual scheduling logic will be tied to task creation/updates.
        } else {
          // Cancel all scheduled notifications if user disables reminders
          PushNotification.cancelAllLocalNotifications();
          console.log("Notifications disabled in-app. All scheduled task reminders cancelled.");
        }
      }
    } catch (error) {
      console.error("SettingsScreen: Failed to save app setting:", error);
      Alert.alert("Error", "Could not save your setting. Please try again.");
      setAppSettings(appSettings); // Revert
    }
  };

  const handleThemeChange = (newPreference: ThemePreference) => {
    setThemePreference(newPreference);
  };

  const handleClearAllTaskData = () => {
    Alert.alert(
      "Confirm Delete All Data",
      "Are you sure you want to delete ALL task data?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            setIsClearingData(true);
            try {
              await AsyncStorage.removeItem(TASKS_STORAGE_KEY);
              PushNotification.cancelAllLocalNotifications(); // Cancel notifications too
              Alert.alert("Success", "All task data and reminders have been cleared.");
              navigation.navigate('TaskList', { refresh: true });
            } catch (error) {
              Alert.alert("Error", "Could not clear task data.");
            } finally {
              setIsClearingData(false);
            }
          }
        }
      ]
    );
  };
  
  const openAppSettings = () => {
      Linking.openSettings();
  }

  const cardBg = isDarkMode ? '#2D3748' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#E2E8F0' : '#1A202C';
  const textSecondary = isDarkMode ? '#A0AEC0' : '#4A5568';
  const switchThumbColor = Platform.OS === 'android' ? (isDarkMode ? '#A0AEC0' : '#FFFFFF') : undefined;
  const switchTrackColor = { false: isDarkMode ? '#4A5568' : '#E2E8F0', true: isDarkMode ? '#38A169' : '#48BB78' };
  const activeThemeButtonBg = isDarkMode ? '#4A5568' : '#CBD5E0';
  const inactiveThemeButtonBg = isDarkMode ? '#2D3748' : '#E2E8F0';


  if (isLoading) {
      return (
          <View style={[styles.loaderContainer, { backgroundColor: isDarkMode ? '#1A202C' : '#F7FAFC'}]}>
              <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#1D4ED8'} />
              <Text style={{color: textSecondary, marginTop: 10}}>Loading Settings...</Text>
          </View>
      )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#1F2937' : '#EDF2F7' }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Appearance</Text>
        <View style={[styles.settingItem, { backgroundColor: cardBg, flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text style={[styles.settingText, { color: textPrimary, marginBottom: 10 }]}>Theme</Text>
          <View style={styles.themeSelectorContainer}>
            {(['Light', 'Dark', 'System'] as const).map((themeOption) => {
              const themeValue = themeOption.toLowerCase() as ThemePreference;
              return (
                <TouchableOpacity
                  key={themeValue}
                  style={[
                    styles.themeButton,
                    { backgroundColor: themePreference === themeValue ? activeThemeButtonBg : inactiveThemeButtonBg },
                    themePreference === themeValue && styles.themeButtonSelected(isDarkMode)
                  ]}
                  onPress={() => handleThemeChange(themeValue)}
                  disabled={isClearingData}
                >
                  <Text style={[styles.themeButtonText, { color: textPrimary }]}>{themeOption}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>General</Text>
        <View style={[styles.settingItem, { backgroundColor: cardBg, flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.settingRow}>
                <Text style={[styles.settingText, { color: textPrimary }]}>Enable Reminders</Text>
                <Switch
                    trackColor={switchTrackColor}
                    thumbColor={appSettings.enableNotifications ? (Platform.OS === 'ios' ? '#FFFFFF' : (isDarkMode ? '#38A169' : '#48BB78')) : switchThumbColor}
                    ios_backgroundColor={switchTrackColor.false}
                    onValueChange={(value) => handleAppSettingChange('enableNotifications', value)}
                    value={appSettings.enableNotifications}
                    disabled={isClearingData || !notificationsGloballyEnabled}
                />
            </View>
            {!notificationsGloballyEnabled && (
                <View style={styles.permissionWarningContainer}>
                    <Text style={[styles.permissionWarningText, {color: isDarkMode ? '#FBBF24' : '#D97706'}]}>
                        Notifications are disabled for this app in your device settings.
                    </Text>
                    <TouchableOpacity onPress={openAppSettings}>
                        <Text style={[styles.permissionLink, {color: isDarkMode ? '#60A5FA' : '#2563EB'}]}>Open Settings</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Data Management</Text>
         <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: cardBg }]}
            onPress={() => Alert.alert("Export Data", "Coming soon!")}
            disabled={isClearingData} >
          <Text style={[styles.settingTextAction, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>Export Task Data</Text>
        </TouchableOpacity>
         <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: cardBg, marginTop:1 }]}
            onPress={() => Alert.alert("Import Data", "Coming soon!")}
            disabled={isClearingData} >
          <Text style={[styles.settingTextAction, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>Import Task Data</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: cardBg, marginTop:1, opacity: isClearingData ? 0.5 : 1 }]}
            onPress={handleClearAllTaskData}
            disabled={isClearingData} >
            {isClearingData ? <ActivityIndicator color={isDarkMode ? '#F56565' : '#E53E3E'} size="small" />
            : <Text style={[styles.settingTextAction, { color: isDarkMode ? '#F56565' : '#E53E3E' }]}>Clear All Task Data</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>About</Text>
        <View style={[styles.settingItem, { backgroundColor: cardBg, flexDirection:'column', alignItems: 'flex-start'}]}>
          <Text style={[styles.settingText, { color: textPrimary }]}>App Version</Text>
          <Text style={[styles.subSettingText, { color: textSecondary }]}>1.0.2</Text>
        </View>
         <TouchableOpacity
            style={[styles.settingItemButton, { backgroundColor: cardBg, marginTop:1 }]}
            onPress={() => Alert.alert("Help & Support", "Contact support@example.com.")}
            disabled={isClearingData} >
          <Text style={[styles.settingTextAction, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>Help & Support</Text>
        </TouchableOpacity>
      </View>
      <View style={{height: 30}} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '500', paddingHorizontal: 16, marginBottom: 10, textTransform: 'uppercase', opacity: 0.7 },
  settingItem: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 12, borderRadius: 10, marginBottom: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  permissionWarningContainer: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6, backgroundColor: 'rgba(250, 204, 21, 0.1)'},
  permissionWarningText: { fontSize: 13, marginBottom: 4},
  permissionLink: { fontSize: 13, fontWeight: 'bold'},
  settingItemButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: 12, borderRadius: 10, marginBottom: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1, justifyContent: 'center', alignItems: 'center', minHeight: 50 },
  settingText: { fontSize: 16 },
  subSettingText: { fontSize: 13, marginTop: 2, opacity: 0.8 },
  settingTextAction: { fontSize: 16, fontWeight: '500' },
  themeSelectorContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 5 },
  themeButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 5, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', marginHorizontal: 4 },
  themeButtonSelected: (isCurrentlyDark: boolean) => ({ borderColor: isCurrentlyDark ? '#60A5FA' : '#2563EB', borderWidth: 1.5 }),
  themeButtonText: { fontSize: 14, fontWeight: '500' },
});

export default SettingsScreen;
