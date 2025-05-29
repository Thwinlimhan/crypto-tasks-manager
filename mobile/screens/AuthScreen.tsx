// File: project-root/mobile/screens/AuthScreen.tsx
// Description: Handles user authentication (Sign Up, Sign In, Anonymous Sign In) using Firebase.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Firebase
import auth from '@react-native-firebase/auth';

// Import Theme context
import { useTheme } from '../ThemeContext';
// Import RootStackParamList for navigation typing
import type { RootStackParamList } from '../types';

type AuthNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Auth'>;

const AuthScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // true for Login mode, false for Sign Up mode
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthentication = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Email and password cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await auth().signInWithEmailAndPassword(email, password);
        console.log('User signed in successfully!');
        // Navigation to TaskList will be handled by onAuthStateChanged in App.tsx
      } else {
        await auth().createUserWithEmailAndPassword(email, password);
        console.log('User account created & signed in successfully!');
        // Navigation to TaskList will be handled by onAuthStateChanged in App.tsx
      }
    } catch (e: any) {
      console.error("Authentication Error: ", e.code, e.message);
      switch (e.code) {
        case 'auth/email-already-in-use':
          setError('That email address is already in use by another account.');
          break;
        case 'auth/invalid-email':
          setError('That email address is invalid.');
          break;
        case 'auth/operation-not-allowed':
          setError('Email/password accounts are not enabled.');
          break;
        case 'auth/weak-password':
          setError('Password is too weak. Please choose a stronger password.');
          break;
        case 'auth/user-disabled':
          setError('This user account has been disabled.');
          break;
        case 'auth/user-not-found':
          setError('No user found with this email. Please check your email or sign up.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again.');
          break;
        case 'auth/invalid-credential':
             setError('Invalid credentials. Please check your email and password.');
             break;
        default:
          setError(isLogin ? 'Login failed. Please try again.' : 'Sign up failed. Please try again.');
          break;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await auth().signInAnonymously();
      console.log('User signed in anonymously successfully!');
      // Navigation to TaskList will be handled by onAuthStateChanged in App.tsx
    } catch (e: any) {
      console.error("Anonymous Sign In Error: ", e.code, e.message);
      setError('Anonymous sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic styles based on theme
  const themeStyles = {
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#111827' : '#F3F4F6', // Dark Gray : Light Gray
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 25,
      paddingVertical: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDarkMode ? '#FFFFFF' : '#1F2937', // White : Darker Gray
      textAlign: 'center',
      marginBottom: 30,
    },
    input: {
      height: 50,
      backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', // Darker Gray : White
      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB', // Medium Gray : Light Gray
      borderWidth: 1,
      marginBottom: 15,
      paddingHorizontal: 15,
      borderRadius: 8,
      fontSize: 16,
      color: isDarkMode ? '#E5E7EB' : '#111827', // Lighter Gray : Darkest Gray
    },
    button: {
      backgroundColor: '#3B82F6', // Blue-500
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 12,
      opacity: isLoading ? 0.7 : 1,
    },
    buttonText: {
      color: '#FFFFFF', // White
      fontWeight: 'bold',
      fontSize: 16,
    },
    secondaryButton: {
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: '#3B82F6', // Blue-500
      fontSize: 15,
    },
    anonymousButton: {
      backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', // Medium Gray : Lighter Gray
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      opacity: isLoading ? 0.7 : 1,
    },
    anonymousButtonText: {
      color: isDarkMode ? '#E5E7EB' : '#374151', // Lighter Gray : Medium Gray
      fontWeight: 'bold',
      fontSize: 16,
    },
    errorText: {
      color: isDarkMode ? '#FCA5A5' : '#EF4444', // Light Red : Red
      textAlign: 'center',
      marginBottom: 15,
      fontSize: 14,
    },
    inputPlaceholderTextColor: isDarkMode ? '#9CA3AF' : '#6B7280', // Gray-400 : Gray-500
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={themeStyles.container}
    >
      <ScrollView contentContainerStyle={themeStyles.scrollContainer}>
        <Text style={themeStyles.title}>
          {isLogin ? 'Welcome Back!' : 'Create Account'}
        </Text>

        <TextInput
          style={themeStyles.input}
          placeholder="Email Address"
          placeholderTextColor={themeStyles.inputPlaceholderTextColor}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        <TextInput
          style={themeStyles.input}
          placeholder="Password"
          placeholderTextColor={themeStyles.inputPlaceholderTextColor}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />

        {error && (
          <Text style={themeStyles.errorText}>{error}</Text>
        )}

        <TouchableOpacity
          style={themeStyles.button}
          onPress={handleAuthentication}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={themeStyles.buttonText}>
              {isLogin ? 'Login' : 'Sign Up'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={themeStyles.secondaryButton}
          onPress={() => {
            setIsLogin(!isLogin);
            setError(null); // Clear error when switching mode
          }}
          disabled={isLoading}
        >
          <Text style={themeStyles.secondaryButtonText}>
            {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
          </Text>
        </TouchableOpacity>

        <View style={{height:1, backgroundColor: isDarkMode ? '#374151' : '#D1D5DB', marginVertical: 20}} />
        
        <TouchableOpacity
          style={themeStyles.anonymousButton}
          onPress={handleAnonymousSignIn}
          disabled={isLoading}
        >
          {isLoading && !isLogin && !email ? ( // Show loader only if this button caused it
            <ActivityIndicator color={isDarkMode ? '#E5E7EB' : '#374151'} />
          ) : (
            <Text style={themeStyles.anonymousButtonText}>
              Continue Anonymously
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Styles (can be kept minimal if dynamic styles cover most cases)
const styles = StyleSheet.create({
  // No static styles needed if all are dynamic via themeStyles
});

export default AuthScreen;
