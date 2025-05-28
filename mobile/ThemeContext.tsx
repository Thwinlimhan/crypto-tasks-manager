// File: project-root/mobile/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = 'airdrop-app-settings'; // Must match SettingsScreen

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themePreference: ThemePreference;
  resolvedTheme: 'light' | 'dark'; // Actual theme being applied (light or dark)
  setThemePreference: (theme: ThemePreference) => void;
  isSystemDark: boolean; // Expose system's dark mode status
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemTheme = useSystemColorScheme(); // 'light' or 'dark' from OS
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(systemTheme);
  const [isSystemDark, setIsSystemDark] = useState(systemTheme === 'dark');

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedSettingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettingsString) {
          const storedSettings = JSON.parse(storedSettingsString);
          if (storedSettings.theme && ['light', 'dark', 'system'].includes(storedSettings.theme)) {
            setThemePreferenceState(storedSettings.theme);
          }
        }
      } catch (error) {
        console.error("ThemeProvider: Failed to load theme preference from AsyncStorage:", error);
      }
    };
    loadThemePreference();
  }, []);

  // Update resolved theme when preference or system theme changes
  useEffect(() => {
    if (themePreference === 'system') {
      setResolvedTheme(systemTheme);
    } else {
      setResolvedTheme(themePreference);
    }
    setIsSystemDark(systemTheme === 'dark'); // Keep isSystemDark updated
  }, [themePreference, systemTheme]);

  // Function to update theme preference and save it
  const setThemePreference = async (newPreference: ThemePreference) => {
    setThemePreferenceState(newPreference); // Update state immediately
    try {
      const storedSettingsString = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      let currentSettings = {};
      if (storedSettingsString) {
        currentSettings = JSON.parse(storedSettingsString);
      }
      const updatedSettings = { ...currentSettings, theme: newPreference };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      console.log("ThemeProvider: Theme preference saved:", newPreference);

      // Forcing Appearance API for immediate effect on some native components if needed,
      // though React Navigation and custom components should re-render based on context.
      // Appearance.setColorScheme(newPreference === 'system' ? null : newPreference);
      // Note: Directly setting Appearance.setColorScheme might conflict with system settings.
      // It's generally better to let components consume the resolvedTheme from context.

    } catch (error) {
      console.error("ThemeProvider: Failed to save theme preference to AsyncStorage:", error);
    }
  };
  
  // Listen to OS theme changes if 'system' is selected
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        console.log("ThemeProvider: System color scheme changed to:", colorScheme);
        // This will trigger the useEffect above to update resolvedTheme if preference is 'system'
        // and also updates the systemTheme hook's value.
        // No explicit action needed here if dependencies are correct in other useEffects.
    });
    return () => subscription.remove();
  }, []);


  return (
    <ThemeContext.Provider value={{ themePreference, resolvedTheme, setThemePreference, isSystemDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
