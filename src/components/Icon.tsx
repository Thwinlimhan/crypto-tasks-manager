// File: src/components/Icon.tsx
import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

const Icon: React.FC<IconProps> = ({ name, className = "w-4 h-4", color = "currentColor", strokeWidth = 2 }) => {
    // In a real app, use a library like lucide-react or SVGs
    // Keeping the provided SVG paths
    const iconPaths: Record<string, string> = {
        Plus: "M12 5v14m-7-7h14",
        Play: "m5 3 14 9-14 9V3z",
        CheckCircle: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
        Calendar: "M8 2v4m8-4v4M3.5 20.5h17A1.5 1.5 0 0 0 22 19V6.5a1.5 1.5 0 0 0-1.5-1.5h-17A1.5 1.5 0 0 0 2 6.5V19a1.5 1.5 0 0 0 1.5 1.5Z",
        Zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8Z",
        Trophy: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M9 12v7M15 12v7M12 12v7M9 4h6M9 9h6m-3 3v-3M12 19.5A2.5 2.5 0 0 1 9.5 22h-2A2.5 2.5 0 0 1 5 19.5V17a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 1-2.5 2.5h-2A2.5 2.5 0 0 1 12 19.5Z",
        Search: "m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
        Trash2: "M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6m4-6v6",
        Power: "M12 2v10m6.36-7.78a8 8 0 1 1-12.72 0",
        Settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l-.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
        X: "M18 6 6 18M6 6l12 12",
        Download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
        Upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
        Archive: "M21 8v13H3V8M1 3h22v5H1zM10 12h4", // Added Archive icon path
        Eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
        EyeOff: "m9.9 4.24 1.26-1.26a10 10 0 0 1 8.63 9.02 M6.36 6.36C3.63 8.18 2 12 2 12s3 7 10 7c2.05 0 3.94-.63 5.57-1.7 M12 15a3 3 0 0 1-3-3 M9.88 9.88 4.24 4.24",
        PauseCircle: "M10 15V9m4 6V9M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
        PlayCircle: "m10 8 6 4-6 4V8zM12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",

    };
    return (
        React.createElement('svg', {
          xmlns: "http://www.w3.org/2000/svg", 
          width: "24", 
          height: "24", 
          viewBox: "0 0 24 24", 
          fill: "none", 
          stroke: color, 
          strokeWidth: strokeWidth, 
          strokeLinecap: "round", 
          strokeLinejoin: "round", 
          className: className
        }, React.createElement('path', { d: iconPaths[name] || "" }))
    );
};

export default Icon;
