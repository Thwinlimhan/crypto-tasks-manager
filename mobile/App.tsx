// File: project-root/mobile/App.tsx
// Description: Main entry point for the React Native application.
// Initializes Firebase, sets up navigation, theme, and global providers.

import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, TouchableOpacity, Text, Platform, View, ActivityIndicator, Alert } from 'react-native';

// Firebase
import firebase from '@react-native-firebase/app'; // Core app
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'; // Auth module

// Push Notifications
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import PushNotification from 'react-native-push-notification';

// Screen components
import TaskListScreen from './screens/TaskListScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import AddTaskScreen from './screens/AddTaskScreen';
import SettingsScreen from './screens/SettingsScreen';
// Placeholder for AuthScreen - you would create this screen
// import AuthScreen from './screens/AuthScreen'; 

// Shared types
import type { RootStackParamList } from './types';

// Theme context
import { ThemeProvider, useTheme } from './ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Notification Channel ID (Android)
const NOTIFICATION_CHANNEL_ID = "airdrop-task-reminders"; // Ensure this matches NotificationManager.ts

// Simple Gear Icon (retained)
const SettingsIcon = ({ color }: { color: string }) => (
  <Text style={{ color: color, fontSize: Platform.OS === 'ios' ? 22 : 24, marginRight: Platform.OS === 'ios' ? 0 : 5, fontWeight: 'bold' }}>
    ⚙
  </Text>
);

// Custom theme objects (retained)
const LightAppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3182CE', background: '#F3F4F6', card: '#FFFFFF',
    text: '#111827', border: '#E2E8F0', notification: '#EF4444',
  },
};
const DarkAppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#60A5FA', background: '#111827', card: '#1F2937',
    text: '#FFFFFF', border: '#374151', notification: '#F87171',
  },
};

// Placeholder AuthScreen component - replace with your actual implementation
const AuthScreenPlaceholder = ({ navigation }: { navigation: any }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const handleAuth = async () => {
        setLoading(true);
        setError('');
        try {
            if (isLogin) {
                await auth().signInWithEmailAndPassword(email, password);
            } else {
                await auth().createUserWithEmailAndPassword(email, password);
            }
            // Navigation to TaskList will be handled by onAuthStateChanged in AppMobile
        } catch (e: any) {
            setError(e.message);
            console.error("Auth Error:", e);
        } finally {
            setLoading(false);
        }
    };
    
    const handleAnonymousSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await auth().signInAnonymously();
        } catch (e: any) {
            setError(e.message);
            console.error("Anonymous Auth Error:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: isDark ? '#111827' : '#F3F4F6' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: isDark ? '#FFF' : '#000' }}>
                {isLogin ? 'Login' : 'Sign Up'}
            </Text>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 10, paddingHorizontal: 10, borderRadius: 5, color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#1F2937' : '#FFF' }}
                placeholderTextColor={isDark ? '#777' : '#999'}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{ height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 20, paddingHorizontal: 10, borderRadius: 5, color: isDark ? '#FFF' : '#000', backgroundColor: isDark ? '#1F2937' : '#FFF' }}
                placeholderTextColor={isDark ? '#777' : '#999'}
            />
            {error ? <Text style={{ color: 'red', textAlign: 'center', marginBottom: 10 }}>{error}</Text> : null}
            <TouchableOpacity
                onPress={handleAuth}
                disabled={loading}
                style={{ backgroundColor: '#3B82F6', padding: 15, borderRadius: 5, alignItems: 'center', marginBottom: 10, opacity: loading ? 0.7 : 1 }}
            >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{isLogin ? 'Login' : 'Sign Up'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => setIsLogin(!isLogin)}
                style={{ padding: 10, alignItems: 'center', marginBottom: 10 }}
            >
                <Text style={{ color: '#3B82F6' }}>
                    {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
                </Text>
            </TouchableOpacity>
             <TouchableOpacity
                onPress={handleAnonymousSignIn}
                disabled={loading}
                style={{ backgroundColor: '#10B981', padding: 15, borderRadius: 5, alignItems: 'center', opacity: loading ? 0.7 : 1 }}
            >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Continue Anonymously</Text>}
            </TouchableOpacity>
        </View>
    );
};


const AppNavigator = () => {
  const { resolvedTheme } = useTheme();
  const navigationTheme = resolvedTheme === 'dark' ? DarkAppTheme : LightAppTheme;

  const headerBackgroundColor = navigationTheme.colors.card;
  const headerTintColor = navigationTheme.colors.text;

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Handle user state changes
  function onAuthStateChanged(currentUser: FirebaseAuthTypes.User | null) {
    setUser(currentUser);
    if (initializing) {
      setInitializing(false);
    }
    console.log("AppNavigator: Auth state changed, user:", currentUser ? currentUser.uid : 'null');
  }

  useEffect(() => {
    // Ensure Firebase is initialized.
    // This check is often done here or in a dedicated firebase.js/ts config file.
    if (firebase.apps.length === 0) {
        // If you have a firebaseConfig object (from your Firebase project settings)
        // firebase.initializeApp(firebaseConfig); 
        // For @react-native-firebase, usually, the native configuration (google-services.json / GoogleService-Info.plist)
        // handles initialization automatically when the native modules load.
        // However, it's good practice to ensure it's ready.
        console.log("Firebase app initialized via native config.");
    } else {
        console.log("Firebase app already initialized.");
    }

    const authSubscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return authSubscriber; // unsubscribe on unmount
  }, []);

  useEffect(() => {
    // Configure Push Notifications (moved from TaskListScreen to App.tsx for global setup)
    PushNotification.configure({
      onRegister: function (token) {
        console.log("NOTIFICATION TOKEN:", token);
      },
      onNotification: function (notification) {
        console.log("NOTIFICATION RECEIVED:", notification);
        // Handle notification tap: navigate to task detail if taskId is present
        if (notification.userInteraction && notification.data && notification.data.taskId) {
            // This requires a way to access navigation prop here.
            // One common way is to use a navigation ref at the root.
            // For simplicity, we'll log, but ideally, you navigate.
            console.log(`User tapped notification for task: ${notification.data.taskId}. Implement navigation.`);
            // Example: navigationRef.current?.navigate('TaskDetail', { taskId: notification.data.taskId, taskName: notification.title });
        }
        if (Platform.OS === 'ios') {
            notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },
      onAction: function (notification) {
        console.log("NOTIFICATION ACTION:", notification.action);
        console.log("NOTIFICATION:", notification);
      },
      onRegistrationError: function(err) {
        console.error("Notification Registration Error:", err.message, err);
      },
      permissions: { alert: true, badge: true, sound: true },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: NOTIFICATION_CHANNEL_ID,
          channelName: "Task Reminders",
          channelDescription: "Channel for Airdrop Task Reminders",
          playSound: true,
          soundName: "default",
          importance: 4, // Importance.HIGH
          vibrate: true,
        },
        (created) => console.log(`Notification channel '${NOTIFICATION_CHANNEL_ID}' created: ${created}`)
      );
    }
  }, []);


  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: navigationTheme.colors.background }}>
        <ActivityIndicator size="large" color={navigationTheme.colors.primary} />
        <Text style={{ marginTop: 10, color: navigationTheme.colors.text }}>Initializing App...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={navigationTheme.colors.background} // Use background color from theme
      />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: headerBackgroundColor },
          headerTintColor: headerTintColor,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {!user ? (
          // User is not signed in
          <Stack.Screen 
            name="Auth" // Assuming you have an AuthScreen
            component={AuthScreenPlaceholder} // Replace with your actual AuthScreen
            options={{ title: 'Sign In / Sign Up', headerShown: false }} 
          />
        ) : (
          // User is signed in
          <>
            <Stack.Screen
              name="TaskList"
              component={TaskListScreen}
              options={({ navigation }) => ({
                title: 'Airdrop Tasks',
                headerRight: () => (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Settings')}
                    style={{ paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <SettingsIcon color={headerTintColor} />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={({ route }) => ({ title: route.params?.taskName || 'Task Details' })}
            />
            <Stack.Screen
              name="AddTask"
              component={AddTaskScreen}
              // Pass userId to AddTaskScreen if needed, though it now gets it from auth state
              // initialParams={user ? { currentUserId: user.uid } : undefined} 
              options={{ title: 'Add/Edit Task', presentation: 'modal' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const AppMobile = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default AppMobile;
