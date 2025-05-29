// File: project-root/mobile/App.tsx
// Main application component for the mobile app.
// Sets up navigation, theme, and global notification handling including deep linking.
// Added a loading indicator during auth state check.

import React, { useEffect, useRef, useState } from 'react'; // Added useState
import { NavigationContainer, NavigationContainerRef, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, AppState, AppStateStatus, View, Text, ActivityIndicator, StyleSheet } from 'react-native'; // Added View, Text, ActivityIndicator, StyleSheet
import PushNotification, { ReceivedNotification } from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

// Import screens
import TaskListScreen from './screens/TaskListScreen';
import AddTaskScreen from './screens/AddTaskScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import SettingsScreen from './screens/SettingsScreen';
import AuthScreen from './screens/AuthScreen';

// Import types
import type { RootStackParamList } from './types';

// Import Theme Provider and hook
import { ThemeProvider, useTheme } from './ThemeContext';

// Import Notification Manager configuration
import { configureNotifications, generateNumericNotificationId } from './NotificationManager';

// Firebase
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging'; // For potential future FCM

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

function navigateToTaskDetail(taskId: string, taskName?: string) {
  if (navigationRef.isReady()) {
    console.log(`App: Navigating to TaskDetail for taskId: ${taskId}`);
    navigationRef.navigate('TaskDetail', { taskId, taskName: taskName || "Task Details" });
  } else {
    console.warn("App: Navigation not ready, cannot deep link to task yet.");
    setTimeout(() => {
        if (navigationRef.isReady()) {
            navigationRef.navigate('TaskDetail', { taskId, taskName: taskName || "Task Details" });
        } else {
            console.error("App: Navigation still not ready after delay for deep link.");
        }
    }, 1000); 
  }
}

// Simple Loading Screen Component
const LoadingScreen = () => {
    const { resolvedTheme } = useTheme();
    const isDarkMode = resolvedTheme === 'dark';
    return (
        <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#1A202C' : '#F7FAFC' }]}>
            <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#1D4ED8'} />
            <Text style={[styles.loadingText, { color: isDarkMode ? '#A0AEC0' : '#4A5568'}]}>Loading App...</Text>
        </View>
    );
};


const AppContent = () => {
  const { resolvedTheme } = useTheme();
  const [initialRouteName, setInitialRouteName] = useState<'Auth' | 'TaskList'>('Auth');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    configureNotifications();

    PushNotification.configure({
      onRegister: function (token) {
        console.log("NOTIFICATION TOKEN:", token);
      },
      onNotification: function (notification: Omit<ReceivedNotification, 'userInfo'> & { userInfo?: any, data?: any }) {
        console.log("LOCAL NOTIFICATION OPENED (onNotification):", notification);
        const isFromTaskManager = notification.data?.source === 'AirdropTaskManagerApp' || notification.userInfo?.source === 'AirdropTaskManagerApp';
        if (isFromTaskManager) {
            const taskId = notification.data?.taskId || notification.userInfo?.taskId;
            const taskName = notification.data?.taskName || notification.userInfo?.taskName;
            if (taskId) {
                console.log(`App: Notification opened with taskId: ${taskId}`);
                navigateToTaskDetail(taskId, taskName);
            } else {
                console.warn("App: Notification opened but taskId is missing in data/userInfo.");
            }
        } else {
            console.log("App: Notification opened from unknown source or without task data.");
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
        console.error("NOTIFICATION REGISTRATION ERROR:", err.message, err);
      },
      permissions: { alert: true, badge: true, sound: true },
      popInitialNotification: true, 
      requestPermissions: Platform.OS === 'ios', 
    });

    if (Platform.OS === 'ios') {
      PushNotificationIOS.getInitialNotification().then(notification => {
        if (notification) {
          console.log('App: iOS Initial notification:', notification.getUserInfo());
          const userInfo = notification.getUserInfo();
           if (userInfo && userInfo.source === 'AirdropTaskManagerApp' && userInfo.taskId) {
            console.log(`App: iOS app opened from killed state by notification for taskId: ${userInfo.taskId}`);
            setTimeout(() => navigateToTaskDetail(userInfo.taskId, userInfo.taskName), 500);
          }
        }
      });
    }

    const subscriber = auth().onAuthStateChanged(user => {
      if (user) {
        setInitialRouteName('TaskList');
      } else {
        setInitialRouteName('Auth');
      }
      setIsAuthLoading(false);
    });

    const subscription = AppState.addEventListener("change", nextAppState => {
        if (appState.current.match(/inactive|background/) && nextAppState === "active") {
            console.log("App has come to the foreground!");
            if (Platform.OS === 'ios') {
                PushNotificationIOS.getApplicationIconBadgeNumber(num => {
                    if (num > 0) PushNotificationIOS.setApplicationIconBadgeNumber(0);
                });
            }
        }
        appState.current = nextAppState;
    });

    return () => {
        subscriber();
        subscription.remove();
    };
  }, []);

  if (isAuthLoading) {
    return <LoadingScreen />; // Display loading screen
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TaskList" component={TaskListScreen} options={{ title: 'Airdrop Tasks' }} />
        <Stack.Screen name="AddTask" component={AddTaskScreen} options={{ title: 'Add/Edit Task' }} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task Details' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    }
});

export default App;
