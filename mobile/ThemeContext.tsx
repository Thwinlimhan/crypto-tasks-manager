// File: project-root/mobile/ThemeContext.tsx
// Description: Manages the application's theme (light, dark, system)
// and provides theme information to all components.

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useColorScheme as useSystemColorScheme, Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = 'airdrop-app-settings'; // Key to store app settings, including theme

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (theme: ThemePreference) => void;
  isSystemDark: boolean; // Exposes system's dark mode status
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Get the current system theme ('light', 'dark', or null if undefined)
  const systemTheme = useSystemColorScheme();

  // State for the user's explicit theme preference ('light', 'dark', or 'system')
  // Defaults to 'system' if no preference is stored.
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  // State for the actual theme being applied ('light' or 'dark')
  // Defaults to the system theme or 'light' if systemTheme is null.
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(systemTheme || 'light');

  // State to track if the system is currently in dark mode
  const [isSystemDark, setIsSystemDark] = useState<boolean>(systemTheme === 'dark');

  // Load saved theme preference from AsyncStorage on initial mount
  const loadThemePreference = useCallback(async () => {
    try {
      const storedSettingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettingsString) {
        const storedSettings = JSON.parse(storedSettingsString);
        if (storedSettings.theme && ['light', 'dark', 'system'].includes(storedSettings.theme)) {
          setThemePreferenceState(storedSettings.theme);
          console.log("ThemeProvider: Loaded theme preference from AsyncStorage:", storedSettings.theme);
        } else {
          console.log("ThemeProvider: No valid theme preference found in AsyncStorage, defaulting to 'system'.");
          setThemePreferenceState('system'); // Default if not found or invalid
        }
      } else {
        console.log("ThemeProvider: No settings found in AsyncStorage, defaulting theme preference to 'system'.");
        setThemePreferenceState('system'); // Default if no settings exist
      }
    } catch (error) {
      console.error("ThemeProvider: Failed to load theme preference from AsyncStorage:", error);
      setThemePreferenceState('system'); // Default on error
    }
  }, []);

  useEffect(() => {
    loadThemePreference();
  }, [loadThemePreference]);

  // Update resolved theme whenever the user's preference or the system theme changes
  useEffect(() => {
    const currentSystemTheme: ResolvedTheme = systemTheme || 'light'; // Fallback if systemTheme is null
    if (themePreference === 'system') {
      setResolvedTheme(currentSystemTheme);
    } else {
      setResolvedTheme(themePreference);
    }
    setIsSystemDark(currentSystemTheme === 'dark');
    console.log(`ThemeProvider: Theme updated. Preference: ${themePreference}, System: ${currentSystemTheme}, Resolved: ${themePreference === 'system' ? currentSystemTheme : themePreference}`);
  }, [themePreference, systemTheme]);

  // Function to update the theme preference and save it to AsyncStorage
  const setThemePreference = useCallback(async (newPreference: ThemePreference) => {
    setThemePreferenceState(newPreference); // Update state immediately for responsive UI
    try {
      const storedSettingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      let currentSettings = {}; // Initialize as empty object
      if (storedSettingsString) {
        try {
          currentSettings = JSON.parse(storedSettingsString);
        } catch (parseError) {
          console.error("ThemeProvider: Error parsing existing settings from AsyncStorage:", parseError);
          // Decide on recovery strategy: overwrite or preserve other settings if possible
          // For simplicity, we'll overwrite with a new settings object containing only the theme.
          currentSettings = {};
        }
      }
      // Ensure currentSettings is an object before spreading
      const updatedSettings = { ...(typeof currentSettings === 'object' && currentSettings !== null ? currentSettings : {}), theme: newPreference };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      console.log("ThemeProvider: Theme preference saved to AsyncStorage:", newPreference);
    } catch (error) {
      console.error("ThemeProvider: Failed to save theme preference to AsyncStorage:", error);
      // Optionally, revert themePreferenceState if saving fails, or notify user
    }
  }, []);
  
  // Listen to OS theme changes to update if 'system' preference is selected
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
        // The `useSystemColorScheme` hook updates automatically.
        // This listener ensures our `systemTheme` derived state (`isSystemDark` and `resolvedTheme` if preference is 'system')
        // also reacts if the hook itself doesn't trigger a re-render immediately for all dependent logic.
        // `systemTheme` from the hook should be the source of truth for the OS theme.
        console.log("ThemeProvider: System color scheme changed via Appearance API listener to:", colorScheme);
    });
    return () => {
        if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
        }
    };
  }, []);


  return (
    <ThemeContext.Provider value={{ themePreference, resolvedTheme, setThemePreference, isSystemDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context, ensuring it's used within a provider
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
