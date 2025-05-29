import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    signInWithCustomToken
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    onSnapshot, 
    serverTimestamp, 
    Timestamp,
    writeBatch,
    query,
    setLogLevel
} from 'firebase/firestore';

// --- Type Definitions (from src/types/index.ts) ---
import { AirdropTask, AirdropTaskFS, TaskStep } from './types'; 

// --- Imported Components ---
import Icon from './components/Icon';
import AuthComponent from './components/AuthComponent';
import AnalyticsDashboard from './components/AnalyticsDashboard';

// --- Imported Firestore Helper ---
import { getWebTasksCollectionPathForUser } from './utils/firestoreHelper';

// VAPID public key - replace with your actual key
const VAPID_PUBLIC_KEY = 'YOUR_PUBLIC_VAPID_KEY_HERE'; // IMPORTANT: Replace this!

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}


// --- Main AirdropManager Application Component ---
const AirdropManager = ({ userId, db, authInstance }: { userId: string, db: any, authInstance: any }) => {
  const [tasks, setTasks] = useState<AirdropTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AirdropTask | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [newTaskForm, setNewTaskForm] = useState<{
    name: string;
    description: string;
    interval: AirdropTask['interval'];
    category: string;
    priority: AirdropTask['priority'];
    steps: TaskStep[]; 
  }>({ 
    name: '', 
    description: '', 
    interval: 'daily', 
    category: 'DeFi', 
    priority: 'medium', 
    steps: [{ id: `new-${Date.now()}`, title: '', description: '', isCompleted: false, order: 1 }] 
  });
  const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // Electron specific states
  const [isElectron, setIsElectron] = useState(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [minimizeToTrayEnabled, setMinimizeToTrayEnabled] = useState(true);
  const [updateStatusMessage, setUpdateStatusMessage] = useState(''); 

  // State for delete confirmation modal
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<AirdropTask | null>(null);

  // Push Notification State
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushSubscriptionLoading, setPushSubscriptionLoading] = useState(false);
  const [pushNotificationSupported, setPushNotificationSupported] = useState(false);


  const current_app_id = typeof __app_id !== 'undefined' ? __app_id : undefined;

  // Auto-dismiss feedback message
  useEffect(() => {
    if (feedbackMessage.text) {
      const timer = setTimeout(() => {
        setFeedbackMessage({ text: '', type: '' });
      }, 3500); 
      return () => clearTimeout(timer); 
    }
  }, [feedbackMessage]);

  // Auto-dismiss general update status messages
   useEffect(() => {
    if (updateStatusMessage && !updateStatusMessage.toLowerCase().includes('downloaded')) {
      const timer = setTimeout(() => {
        setUpdateStatusMessage('');
      }, 7000); 
      return () => clearTimeout(timer);
    }
  }, [updateStatusMessage]);


  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
        setIsElectron(true);
        (window as any).electronAPI.getAutoLaunchStatus().then(setAutoLaunchEnabled);
        (window as any).electronAPI.getMinimizeToTrayStatus().then(setMinimizeToTrayEnabled);

        const removeSettingsNavListener = (window as any).electronAPI.onNavigateToSettings(() => {
            setShowAnalytics(false); 
            const settingsElement = document.getElementById('settings-section-web');
            if (settingsElement) {
                settingsElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
        
        const removeSignOutResetListener = (window as any).electronAPI.onFirebaseSignOutRequestForReset(async () => {
            console.log("Renderer: Received request to sign out for app data reset.");
            if (authInstance) {
                try {
                    await signOut(authInstance);
                    console.log("Renderer: Firebase sign-out successful for reset.");
                } catch (e) {
                    console.error("Renderer: Firebase sign-out error during reset:", e);
                } finally {
                    (window as any).electronAPI.sendFirebaseSignOutCompleteForReset();
                }
            } else {
                 console.warn("Renderer: Auth instance not available for reset sign-out.");
                (window as any).electronAPI.sendFirebaseSignOutCompleteForReset(); 
            }
        });
        
        const removeUpdateMessageListener = (window as any).electronAPI.onUpdateMessage((message: string) => {
            console.log("Renderer: Update message received:", message);
            setUpdateStatusMessage(message);
        });

        return () => {
            if (removeSettingsNavListener && typeof removeSettingsNavListener === 'function') removeSettingsNavListener();
            if (removeSignOutResetListener && typeof removeSignOutResetListener === 'function') removeSignOutResetListener();
            if (removeUpdateMessageListener && typeof removeUpdateMessageListener === 'function') removeUpdateMessageListener();
        };
    }
  }, [authInstance]); 

  // Check for Push Notification support and existing subscription
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        setPushNotificationSupported(true);
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(subscription => {
                setIsPushSubscribed(!!subscription);
            });
        });
    } else {
        setPushNotificationSupported(false);
    }
  }, []);


  const handlePushSubscriptionToggle = async () => {
    if (!pushNotificationSupported || VAPID_PUBLIC_KEY === 'YOUR_PUBLIC_VAPID_KEY_HERE') {
        setFeedbackMessage({ text: 'Push notifications are not supported by your browser or VAPID key is missing.', type: 'error' });
        if (VAPID_PUBLIC_KEY === 'YOUR_PUBLIC_VAPID_KEY_HERE') {
            console.error("VAPID_PUBLIC_KEY is not set. Please replace 'YOUR_PUBLIC_VAPID_KEY_HERE' in src/App.tsx.");
        }
        return;
    }
    setPushSubscriptionLoading(true);

    try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
            await existingSubscription.unsubscribe();
            console.log('User unsubscribed from push notifications.');
            setIsPushSubscribed(false);
            setFeedbackMessage({ text: 'Unsubscribed from notifications.', type: 'info' });
        } else {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setFeedbackMessage({ text: 'Notification permission denied.', type: 'warning' });
                setPushSubscriptionLoading(false);
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            console.log('User subscribed to push notifications:', JSON.stringify(subscription));
            setIsPushSubscribed(true);
            setFeedbackMessage({ text: 'Subscribed to notifications!', type: 'success' });
        }
    } catch (error: any) {
        console.error('Error during push subscription toggle:', error);
        setFeedbackMessage({ text: `Error with notifications: ${error.message}`, type: 'error' });
    } finally {
        setPushSubscriptionLoading(false);
    }
  };


  const handleAutoLaunchToggle = async (enable: boolean) => {
    if (isElectron && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.setAutoLaunch(enable);
        if (result.success) {
            setAutoLaunchEnabled(enable);
            setFeedbackMessage({text: `Auto-launch ${enable ? 'enabled' : 'disabled'}.`, type: 'success'});
        } else {
            setFeedbackMessage({text: `Failed to update auto-launch: ${result.error}`, type: 'error'});
        }
    }
  };

  const handleMinimizeToTrayToggle = async (enable: boolean) => {
    if (isElectron && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.setMinimizeToTray(enable);
        if (result.success) {
            setMinimizeToTrayEnabled(enable);
            setFeedbackMessage({text: `Minimize to tray ${enable ? 'enabled' : 'disabled'}.`, type: 'success'});
        } else {
            setFeedbackMessage({text: `Failed to update minimize to tray: ${result.error}`, type: 'error'});
        }
    }
  };
  
  // Data Migration from localStorage to Firestore
  useEffect(() => {
    if (!userId || !db) return;
    const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
    if (!tasksCollectionPath) {
        console.warn("Migration skipped: tasks collection path could not be determined.");
        return;
    }
    const migrateData = async () => { 
      const migrationDoneKey = `migrationDone_${userId}_v1_web_airdropTasks_unified`; 
      if (localStorage.getItem(migrationDoneKey)) return;
      
      const localTasksString = localStorage.getItem('airdrop-tasks-web'); 
      if (localTasksString) {
        try {
          const localTasks = JSON.parse(localTasksString);
          if (localTasks && Array.isArray(localTasks) && localTasks.length > 0) {
            console.log("Starting migration of web tasks from localStorage to Firestore (Unified Path)...");
            const batch = writeBatch(db);
            const tasksCollectionRef = collection(db, tasksCollectionPath);
            
            localTasks.forEach((task: any) => { 
              const firestoreTask = {
                name: task.name || "Untitled Task",
                description: task.description || "",
                interval: ['hourly', 'daily', 'weekly', 'biweekly'].includes(task.interval) ? task.interval : "daily",
                steps: Array.isArray(task.steps) ? task.steps.map((s: any,i: number)=>({ 
                    id: s.id || `${Date.now()}-s${i}`,
                    title: typeof s.title === 'string' ? s.title : (typeof s === 'string' ? s : "Step"), 
                    description: s.description || "", 
                    isCompleted: !!s.isCompleted, 
                    order: typeof s.order === 'number' ? s.order : i + 1
                })) : [],
                streak: Number(task.streak) || 0,
                lastCompleted: task.lastCompleted ? Timestamp.fromDate(new Date(task.lastCompleted)) : null,
                nextDue: task.nextDue ? Timestamp.fromDate(new Date(task.nextDue)) : Timestamp.now(),
                isActive: typeof task.isActive === 'boolean' ? task.isActive : true,
                category: task.category || "DeFi",
                priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : "medium",
                color: task.color || "bg-blue-500",
                userId: userId,
                createdAt: task.createdAt ? Timestamp.fromDate(new Date(task.createdAt)) : Timestamp.now(),
                updatedAt: Timestamp.now(),
              };
              const docRef = task.id ? doc(tasksCollectionRef, task.id) : doc(tasksCollectionRef);
              batch.set(docRef, firestoreTask, { merge: true });
            });
            await batch.commit();
            console.log("Web tasks migration successful to unified path!");
            localStorage.setItem(migrationDoneKey, 'true');
          } else {
            localStorage.setItem(migrationDoneKey, 'true'); 
          }
        } catch (error) {
          console.error("Error migrating web tasks from localStorage:", error);
          logError(error, "DataMigration");
        }
      } else {
        localStorage.setItem(migrationDoneKey, 'true'); 
      }
    };
    migrateData();
  }, [userId, db, current_app_id]);

  // Fetch Tasks from Firestore
  useEffect(() => {
    if (!userId || !db) { 
        setIsLoading(false); 
        setTasks([]); 
        return; 
    }
    const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
    if (!tasksCollectionPath) {
        setIsLoading(false);
        setTasks([]);
        console.warn("Task fetching skipped: tasks collection path could not be determined.");
        return;
    }
    setIsLoading(true);
    const tasksQuery = query(collection(db, tasksCollectionPath));
    const unsubscribe = onSnapshot(tasksQuery, snapshot => {
      const fetchedTasks = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as AirdropTaskFS;
        return {
          id: docSnapshot.id, ...data,
          lastCompleted: data.lastCompleted ? data.lastCompleted.toDate() : null,
          nextDue: data.nextDue.toDate(),
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
          steps: Array.isArray(data.steps) ? data.steps.map(s => ({...s, description: s.description || ''})) : [], 
        } as AirdropTask;
      });
      setTasks(fetchedTasks);
      setIsLoading(false);
    }, error => {
      console.error("Error fetching tasks from Firestore:", error);
      setFeedbackMessage({text: `Error fetching tasks: ${error.message}`, type: 'error'});
      logError(error, "FetchTasksOnSnapshot");
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [userId, db, current_app_id]);

  const addNewTask = async () => {
    const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
    if (!newTaskForm.name.trim() || !userId || !db || !tasksCollectionPath) {
      setFeedbackMessage({text: "Task name is required and user must be authenticated.", type: 'error'});
      return;
    }
    
    const processedSteps = newTaskForm.steps.map((step, index) => ({
        id: step.id && !step.id.startsWith('new-') ? step.id : `${Date.now()}-s${index}`,
        title: step.title.trim() || `Step ${index + 1}`,
        description: step.description.trim() || '', 
        isCompleted: false, 
        order: index + 1,
    })).filter(step => step.title.trim() !== ''); 

    const taskToAdd = {
      name: newTaskForm.name.trim(),
      description: newTaskForm.description.trim(),
      interval: newTaskForm.interval,
      category: newTaskForm.category.trim() || "Uncategorized",
      priority: newTaskForm.priority,
      steps: processedSteps,
      streak: 0,
      lastCompleted: null,
      nextDue: Timestamp.fromDate(new Date()), 
      isActive: true,
      color: `bg-${['blue', 'purple', 'green', 'red', 'yellow', 'pink'][Math.floor(Math.random() * 6)]}-600`,
      userId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, tasksCollectionPath), taskToAdd);
      setShowAddModal(false);
      setNewTaskForm({ name: '', description: '', interval: 'daily', category: 'DeFi', priority: 'medium', steps: [{ id: `new-${Date.now()}`, title: '', description: '', isCompleted: false, order: 1 }] });
      setFeedbackMessage({text: "Task added successfully!", type: 'success'});
    } catch (error: any) {
      console.error("Error adding new task to Firestore:", error);
      setFeedbackMessage({text: `Error adding task: ${error.message}`, type: 'error'});
      logError(error, "AddNewTask");
    }
  };

  const requestDeleteTask = (task: AirdropTask) => {
    setTaskToDelete(task);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete || !userId || !db) return;
    const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
    if (!tasksCollectionPath) {
        setFeedbackMessage({text: "Error: Could not determine data path.", type: 'error'});
        setShowDeleteConfirmModal(false);
        setTaskToDelete(null);
        return;
    }

    try {
      await deleteDoc(doc(db, tasksCollectionPath, taskToDelete.id!)); 
      if (selectedTask && selectedTask.id === taskToDelete.id) setSelectedTask(null);
      setFeedbackMessage({text: `Task "${taskToDelete.name}" deleted successfully.`, type: 'info'});
    } catch (error: any) {
      console.error("Error deleting task from Firestore:", error);
      setFeedbackMessage({text: `Error deleting task: ${error.message}`, type: 'error'});
      logError(error, "ConfirmDeleteTask");
    } finally {
      setShowDeleteConfirmModal(false);
      setTaskToDelete(null);
    }
  };
  
  const completeTask = async (taskId: string) => {
      const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
      if (!userId || !db || !tasksCollectionPath) return;
      const taskRef = doc(db, tasksCollectionPath, taskId);
      try {
          const currentTask = tasks.find(t => t.id === taskId);
          if (!currentTask) { 
              setFeedbackMessage({text: "Task not found for completion.", type: 'error'});
              return; 
          }
          const now = new Date();
          let nextDueDate = new Date(now);
          
          if (currentTask.interval !== 'hourly') {
              nextDueDate.setHours(0, 0, 0, 0); 
          }

          switch (currentTask.interval) {
              case 'hourly': nextDueDate.setHours(now.getHours() + 1); nextDueDate.setMinutes(now.getMinutes()); break;
              case 'daily': nextDueDate.setDate(nextDueDate.getDate() + 1); break;
              case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7); break;
              case 'biweekly': nextDueDate.setDate(nextDueDate.getDate() + 14); break;
          }

          await updateDoc(taskRef, {
              lastCompleted: Timestamp.fromDate(now),
              nextDue: Timestamp.fromDate(nextDueDate),
              streak: (currentTask.streak || 0) + 1,
              steps: currentTask.steps.map(step => ({ ...step, isCompleted: false })), 
              updatedAt: serverTimestamp()
          });
          setSelectedTask(null);
          setFeedbackMessage({text: `Task "${currentTask.name}" completed! Great job!`, type: 'success'});
      } catch (error: any) {
          console.error("Error completing task in Firestore:", error);
          setFeedbackMessage({text: `Error completing task: ${error.message}`, type: 'error'});
          logError(error, "CompleteTask");
      }
  };

  const toggleTaskActive = async (taskId: string, currentIsActive: boolean) => {
      const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
      if (!userId || !db || !tasksCollectionPath) return;
      try {
          await updateDoc(doc(db, tasksCollectionPath, taskId), {
              isActive: !currentIsActive, 
              updatedAt: serverTimestamp()
          });
          setFeedbackMessage({text: `Task status updated.`, type: 'info'});
      } catch (error: any) {
          console.error("Error toggling task active state:", error);
          setFeedbackMessage({text: `Error updating task status: ${error.message}`, type: 'error'});
          logError(error, "ToggleTaskActive");
      }
  };
  
  const handleStepChangeInModal = (index: number, field: keyof Omit<TaskStep, 'isCompleted' | 'order' | 'id'>, value: string) => {
      const newSteps = [...newTaskForm.steps];
      const stepToUpdate = { ...newSteps[index] };
      (stepToUpdate[field] as any) = value; 
      newSteps[index] = stepToUpdate;
      setNewTaskForm(prev => ({ ...prev, steps: newSteps }));
  };
  const addStepInputInModal = () => setNewTaskForm(prev => ({ ...prev, steps: [...prev.steps, {id: `new-${Date.now()}`, title: '', description: '', isCompleted: false, order: prev.steps.length + 1}] }));
  const removeStepInputInModal = (index: number) => {
      if (newTaskForm.steps.length === 1 && index === 0 && !newTaskForm.steps[0].title && !newTaskForm.steps[0].description) {
        return; 
      }
      if (newTaskForm.steps.length <= 1 && index === 0) { 
        const newSteps = [...newTaskForm.steps];
        newSteps[0] = {id: `new-${Date.now()}`, title: '', description: '', isCompleted: false, order: 1};
        setNewTaskForm(prev => ({ ...prev, steps: newSteps }));
        return;
      }
      const newSteps = newTaskForm.steps.filter((_, i) => i !== index).map((s, idx) => ({...s, order: idx + 1}));
      setNewTaskForm(prev => ({ ...prev, steps: newSteps.length > 0 ? newSteps : [{id: `new-${Date.now()}`, title: '', description: '', isCompleted: false, order: 1}] }));
  };

  const handleExportTasks = async () => {
    const tasksToExport = tasks.map(task => ({
        ...task,
        lastCompleted: task.lastCompleted ? task.lastCompleted.toISOString() : null,
        nextDue: task.nextDue.toISOString(),
        createdAt: task.createdAt ? task.createdAt.toISOString() : undefined,
        updatedAt: task.updatedAt ? task.updatedAt.toISOString() : undefined,
    }));
    const jsonString = JSON.stringify(tasksToExport, null, 2);
    if (isElectron && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.showSaveDialog({ defaultPath: 'airdrop-tasks-export.json', filters: [{ name: 'JSON Files', extensions: ['json'] }] });
        if (!result.canceled && result.filePath) {
            const writeResult = await (window as any).electronAPI.writeFile(result.filePath, jsonString);
            if (writeResult.success) setFeedbackMessage({text: 'Tasks exported successfully!', type: 'success'});
            else {
                setFeedbackMessage({text: `Export failed: ${writeResult.error}`, type: 'error'});
                logError(new Error(writeResult.error), "ElectronExportFileWrite");
            }
        }
    } else { 
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'airdrop-tasks-export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedbackMessage({text: 'Tasks prepared for download.', type: 'success'});
    }
  };

  const handleImportTasks = async (event?: React.ChangeEvent<HTMLInputElement> | null) => {
    const tasksCollectionPath = getWebTasksCollectionPathForUser(userId, current_app_id);
    if (!userId || !db || !tasksCollectionPath) { 
        setFeedbackMessage({text: 'Cannot import: User not signed in or database not ready.', type: 'error'});
        return;
    }
    let fileContent: string | null = null;
    if (isElectron && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON Files', extensions: ['json'] }] });
        if (!result.canceled && result.filePaths.length > 0) {
            const readResult = await (window as any).electronAPI.readFile(result.filePaths[0]);
            if (readResult.success) fileContent = readResult.content;
            else {
                setFeedbackMessage({text: `Import failed: ${readResult.error}`, type: 'error'});
                logError(new Error(readResult.error), "ElectronImportFileRead");
                return;
            }
        } else return; 
    } else if (event && event.target.files && event.target.files[0]) { 
        const file = event.target.files[0];
        fileContent = await file.text();
    } else return; 

    if (fileContent) {
        try {
            const importedTasksRaw = JSON.parse(fileContent);
            if (!Array.isArray(importedTasksRaw)) throw new Error("Invalid file format: Not an array.");

            const batch = writeBatch(db);
            const tasksCollectionRef = collection(db, tasksCollectionPath);
            let importCount = 0;

            importedTasksRaw.forEach((task: any) => {
                if (!task.name || typeof task.name !== 'string') {
                    console.warn("Skipping task due to missing or invalid name:", task);
                    return; 
                }
                const firestoreTask: Partial<AirdropTaskFS> & { userId: string } = {
                    name: task.name,
                    description: task.description || "",
                    interval: ['hourly', 'daily', 'weekly', 'biweekly'].includes(task.interval) ? task.interval : "daily",
                    steps: Array.isArray(task.steps) ? task.steps.map((s: any, i: number) => ({
                        id: s.id || `${Date.now()}-s${i}`, title: s.title || "Step", description: s.description || "", isCompleted: !!s.isCompleted, order: s.order || i + 1
                    })) : [],
                    streak: Number(task.streak) || 0,
                    lastCompleted: task.lastCompleted ? Timestamp.fromDate(new Date(task.lastCompleted)) : null,
                    nextDue: task.nextDue ? Timestamp.fromDate(new Date(task.nextDue)) : Timestamp.now(),
                    isActive: typeof task.isActive === 'boolean' ? task.isActive : true,
                    category: task.category || "DeFi",
                    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : "medium",
                    color: task.color || "bg-blue-500",
                    userId: userId,
                    createdAt: task.createdAt ? Timestamp.fromDate(new Date(task.createdAt)) : Timestamp.now(),
                    updatedAt: Timestamp.now(), 
                };
                const docRef = task.id && typeof task.id === 'string' ? doc(tasksCollectionRef, task.id) : doc(tasksCollectionRef);
                batch.set(docRef, firestoreTask, { merge: true }); 
                importCount++;
            });

            await batch.commit(); 
            setFeedbackMessage({text: `Successfully imported ${importCount} tasks!`, type: 'success'});
        } catch (error: any) {
            console.error("Error importing tasks:", error);
            setFeedbackMessage({text: `Import failed: ${error.message}`, type: 'error'});
            logError(error, "HandleImportTasksParseOrBatch");
        } finally {
            if (event && event.target) event.target.value = ''; 
        }
    }
  };
  
  useEffect(() => { 
      if (isElectron && (window as any).electronAPI) {
          const removeImportListener = (window as any).electronAPI.onTriggerImportTasks(() => handleImportTasks(null));
          const removeExportListener = (window as any).electronAPI.onTriggerExportTasks(handleExportTasks);
          return () => { 
              if (typeof removeImportListener === 'function') removeImportListener();
              if (typeof removeExportListener === 'function') removeExportListener();
          };
      }
  }, [isElectron, tasks, userId, db, current_app_id]); 

  const getPriorityClass = (priority: AirdropTask['priority']) => {
    const priorityMap: Record<AirdropTask['priority'], string> = { 
        low: 'border-l-green-500 bg-green-900/30 hover:bg-green-800/40', 
        medium: 'border-l-yellow-500 bg-yellow-900/30 hover:bg-yellow-800/40', 
        high: 'border-l-red-500 bg-red-900/30 hover:bg-red-800/40' 
    };
    return priorityMap[priority] || 'border-l-gray-500 bg-gray-800/30 hover:bg-gray-700/40';
  };
  const getIntervalBadgeClass = (interval: AirdropTask['interval']) => {
    const intervalMap: Record<AirdropTask['interval'], string> = { 
        hourly: 'bg-cyan-500/80 text-cyan-100', 
        daily: 'bg-blue-500/80 text-blue-100', 
        weekly: 'bg-indigo-500/80 text-indigo-100', 
        biweekly: 'bg-purple-500/80 text-purple-100'
    };
    return intervalMap[interval] || 'bg-gray-500/80 text-gray-100';
  };

  const sortedTasks = useMemo(() => {
      return [...tasks] 
          .filter(task => 
              (filterCategory === 'all' || task.category === filterCategory) && 
              (task.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())))
          )
          .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()); 
  }, [tasks, filterCategory, searchTerm]); 

  const todaysTasks = useMemo(() => {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
      return sortedTasks.filter(task => {
          const dueDate = new Date(task.nextDue);
          return task.isActive && dueDate >= todayStart && dueDate <= todayEnd;
      });
  }, [sortedTasks]);

  const upcomingTasks = useMemo(() => {
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
      return sortedTasks.filter(task => {
          const dueDate = new Date(task.nextDue);
          return task.isActive && dueDate > todayEnd;
      });
  }, [sortedTasks]);
  
  const inactiveOrPastDueTasks = useMemo(() => {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      return sortedTasks.filter(task => !task.isActive || new Date(task.nextDue).getTime() < todayStart.getTime());
  }, [sortedTasks]);

  if (isLoading && tasks.length === 0) return React.createElement('div', {className: "min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center"}, React.createElement('p', {className: "text-xl"}, "Loading tasks from the cloud..."));
  
  const settingsUI = (
    React.createElement('div', { id: "settings-section-web", className: 'settings-section p-4 md:p-6 rounded-xl bg-gray-800/60 backdrop-blur-lg my-6 border border-gray-700/50 shadow-2xl animate-fade-in' },
        React.createElement('h3', {className: 'text-xl md:text-2xl font-semibold text-gray-100 mb-5 border-b border-gray-700 pb-3'}, 'App Settings & Data'),
        
        React.createElement('div', {className: 'flex flex-wrap gap-3 items-center mb-6'},
            React.createElement('button', { onClick: handleExportTasks, className: 'btn btn-primary flex items-center space-x-2' },
                React.createElement(Icon, {name: "Download", className:"w-5 h-5"}), React.createElement('span', null, 'Export All Tasks')),
            isElectron ? 
                React.createElement('button', { onClick: () => handleImportTasks(null), className: 'btn btn-success flex items-center space-x-2' },
                    React.createElement(Icon, {name: "Upload", className:"w-5 h-5"}), React.createElement('span', null, 'Import Tasks (Desktop)')) :
                React.createElement(Fragment, null, 
                    React.createElement('input', { type: 'file', id: 'fileInputWeb', className: 'hidden', onChange: handleImportTasks, accept: '.json' }),
                    React.createElement('label', { htmlFor: 'fileInputWeb', className: 'btn btn-success cursor-pointer flex items-center space-x-2'},
                        React.createElement(Icon, {name: "Upload", className:"w-5 h-5"}), React.createElement('span', null, 'Import Tasks'))
                )
        ),
        
        React.createElement('div', {className: 'mb-6'},
            React.createElement('button', {onClick: () => setShowAnalytics(!showAnalytics), className: `btn ${showAnalytics ? 'btn-warning' : 'btn-info'} flex items-center space-x-2`}, 
                React.createElement(Icon, {name: showAnalytics ? "EyeOff" : "Eye", className:"w-5 h-5"}), 
                React.createElement('span', null, showAnalytics ? 'Hide Analytics' : 'Show Analytics Dashboard')
            )
        ),

        !isElectron && pushNotificationSupported && React.createElement('div', { className: 'mb-6 p-4 border border-gray-700 rounded-lg bg-gray-800/50' },
            React.createElement('h4', { className: 'text-lg font-semibold text-gray-200 mb-3' }, 'Web Notifications'),
            React.createElement('div', { className: 'flex items-center justify-between py-2' },
                React.createElement('label', { htmlFor: 'pushToggle', className: 'text-gray-300 text-sm' }, 'Receive Task Reminders'),
                React.createElement('button', { 
                    id: 'pushToggle',
                    onClick: handlePushSubscriptionToggle,
                    disabled: pushSubscriptionLoading,
                    className: `btn btn-sm ${isPushSubscribed ? 'btn-danger-outline' : 'btn-success-outline'} w-32`
                  }, 
                  pushSubscriptionLoading ? 'Processing...' : (isPushSubscribed ? 'Unsubscribe' : 'Subscribe')
                )
            ),
            VAPID_PUBLIC_KEY === 'YOUR_PUBLIC_VAPID_KEY_HERE' && React.createElement('p', {className: "text-xs text-yellow-400 mt-2"}, "Note: VAPID key not configured for push notifications.")
        ),
        !isElectron && !pushNotificationSupported && React.createElement('div', { className: 'mb-6 p-4 border border-gray-700 rounded-lg bg-gray-800/50' },
            React.createElement('p', { className: 'text-sm text-gray-400'}, 'Web push notifications are not supported by your browser.')
        ),


        isElectron && React.createElement('div', { className: 'mb-6 p-4 border border-gray-700 rounded-lg bg-gray-800/50' },
            React.createElement('h4', { className: 'text-lg font-semibold text-gray-200 mb-3' }, 'Desktop App Settings'),
            React.createElement('div', { className: 'flex items-center justify-between mb-3 py-2' },
                React.createElement('span', { className: 'text-gray-300 text-sm' }, 'Launch App on System Startup'),
                React.createElement('label', { htmlFor: 'autoLaunchToggle', className: 'relative inline-flex items-center cursor-pointer'},
                    React.createElement('input', { type: 'checkbox', id: 'autoLaunchToggle', className: 'sr-only peer', checked: autoLaunchEnabled, onChange: (e) => handleAutoLaunchToggle(e.target.checked) }),
                    React.createElement('div', { className: "w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"})
                )
            ),
            React.createElement('div', { className: 'flex items-center justify-between py-2 mb-3' },
                React.createElement('span', { className: 'text-gray-300 text-sm' }, 'Minimize to System Tray on Close'),
                React.createElement('label', { htmlFor: 'minimizeToTrayToggle', className: 'relative inline-flex items-center cursor-pointer'},
                    React.createElement('input', { type: 'checkbox', id: 'minimizeToTrayToggle', className: 'sr-only peer', checked: minimizeToTrayEnabled, onChange: (e) => handleMinimizeToTrayToggle(e.target.checked) }),
                    React.createElement('div', { className: "w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"})
                )
            ),
            React.createElement('button', { 
                onClick: handleCheckForUpdates, 
                className: 'btn btn-secondary-outline w-full mt-2' 
            }, 'Check for Updates'),
            updateStatusMessage && React.createElement('p', {className: "text-xs text-gray-400 mt-2 text-center"}, updateStatusMessage)

        ),

        feedbackMessage.text && (
            React.createElement('div', { 
                className: `p-3.5 rounded-md mt-4 text-sm border-l-4 ${
                    feedbackMessage.type === 'error' ? 'bg-red-900/30 border-red-500 text-red-300' : 
                    feedbackMessage.type === 'success' ? 'bg-green-900/30 border-green-500 text-green-300' : 
                    'bg-gray-700/50 border-gray-500 text-gray-300'
                } animate-fade-in transition-opacity duration-300`
            }, feedbackMessage.text)
        ))
  );

  const renderTaskCard = (task: AirdropTask) => (
    React.createElement('div', { 
        key: task.id, 
        className: `task-card rounded-xl p-5 border-l-4 shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-primary-500/30 ${getPriorityClass(task.priority)} ${!task.isActive ? 'opacity-50 grayscale-[50%]' : ''}`
      }, 
        React.createElement('div', {className:"flex items-start justify-between mb-3"}, 
            React.createElement('div', {className: "flex items-center space-x-2"},
                React.createElement('div', {className: `w-3 h-3 rounded-full ${task.color || 'bg-gray-400'} shadow-sm`}), 
                React.createElement('span', {className: `px-2.5 py-0.5 text-xs rounded-full font-semibold tracking-wide ${getIntervalBadgeClass(task.interval)}`}, task.interval)
            ),
            React.createElement('div', {className:"flex items-center space-x-1 text-yellow-400/80"}, 
                React.createElement(Icon, {name:"Trophy", className:"w-4 h-4"}), 
                React.createElement('span', {className:"text-xs font-semibold"}, task.streak)
            )
        ),
        React.createElement('h3', {className:"text-lg font-semibold text-gray-100 mb-1.5 truncate", title: task.name}, task.name),
        React.createElement('p', {className:"text-gray-400 text-sm mb-3 h-10 overflow-hidden line-clamp-2"}, task.description || "No description provided."),
        React.createElement('div', {className:"text-xs text-gray-500 mb-1"}, 
            React.createElement('span', {className:"font-medium text-gray-400"},"Priority: "), 
            React.createElement('span', {className: `font-semibold ${task.priority === 'high' ? 'text-red-400' : task.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}, task.priority.charAt(0).toUpperCase() + task.priority.slice(1))
        ),
        React.createElement('div', {className:"text-xs text-gray-500 mb-4"}, 
            React.createElement('span', {className:"font-medium text-gray-400"},"Next Due: "), 
            React.createElement('span', {className:"font-semibold text-gray-300"}, new Date(task.nextDue).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) 
        ),
        React.createElement('div', { className: "mt-auto pt-3 border-t border-gray-700/50" }, 
            React.createElement('button', {
                onClick: () => setSelectedTask(task), 
                className: "w-full btn btn-primary-outline btn-sm flex items-center justify-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed", 
                disabled: !task.isActive
              }, 
              React.createElement(Icon, {name:"Play", className:"w-4 h-4"}),
              React.createElement('span', null, "View & Complete")
            )
        )
    )
  );

  return (
    React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-gray-100" },
        React.createElement('div', { className: "bg-gray-800/80 backdrop-blur-lg border-b border-gray-700/50 sticky top-0 z-40 shadow-2xl" },
            React.createElement('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" },
                React.createElement('div', { className: "flex items-center justify-between flex-wrap gap-4" },
                    React.createElement('div', { className: "flex items-center space-x-3" },
                        React.createElement('div', { className: "p-2.5 bg-gradient-to-tr from-primary-500 to-purple-600 rounded-xl shadow-lg" },
                            React.createElement(Icon, { name: "Zap", className: "w-7 h-7 text-white" })
                        ),
                        React.createElement('div', null,
                            React.createElement('h1', { className: "text-3xl font-bold text-white tracking-tight" }, "Airdrop Manager"),
                            React.createElement('p', { className: "text-sm text-gray-400" }, "Your Ultimate Crypto Task Tracker")
                        )
                    ),
                    React.createElement('div', { className: "flex items-center space-x-4 sm:space-x-6" },
                        React.createElement('div', { className: "text-center" },
                            React.createElement('div', { className: "text-2xl sm:text-3xl font-bold text-white" }, todaysTasks.length),
                            React.createElement('div', { className: "text-xs sm:text-sm text-gray-400" }, "Due Today")
                        ),
                        React.createElement('div', { className: "text-center" },
                            React.createElement('div', { className: "text-2xl sm:text-3xl font-bold text-green-400" }, tasks.reduce((sum, task) => sum + (task.streak || 0), 0)),
                            React.createElement('div', { className: "text-xs sm:text-sm text-gray-400" }, "Total Streak")
                        ),
                        React.createElement('button', { onClick: () => setShowAddModal(true), className: "btn btn-primary flex items-center space-x-2 shadow-md hover:shadow-lg" },
                            React.createElement(Icon, { name: "Plus", className: "w-5 h-5" }), React.createElement('span', { className: "text-sm sm:text-base font-medium" }, "Add Task")
                        )
                    )
                )
            )
        ),
        React.createElement('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
            settingsUI,
            
            showAnalytics && React.createElement(AnalyticsDashboard, { tasks: tasks, userId: userId }),

            !showAnalytics && (
                React.createElement(Fragment, null,
                    React.createElement('div', { className: "flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8 animate-fade-in" },
                        React.createElement('div', { className: "flex-1 relative w-full" },
                            React.createElement(Icon, { name: "Search", className: "absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" }),
                            React.createElement('input', { type: "text", placeholder: "Search tasks by name or description...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "form-input w-full pl-12 pr-4 py-3" })
                        ),
                        React.createElement('select', { value: filterCategory, onChange: (e) => setFilterCategory(e.target.value), className: "form-select w-full sm:w-auto px-4 py-3" },
                            React.createElement('option', { value: "all" }, "All Categories"),
                            React.createElement('option', { value: "DeFi" }, "DeFi"),React.createElement('option', { value: "L2" }, "Layer 2"),React.createElement('option', { value: "Gaming" }, "Gaming"),
                            React.createElement('option', { value: "NFT" }, "NFT"),React.createElement('option', { value: "Bridge" }, "Bridge"),React.createElement('option', { value: "Other" }, "Other")
                        )
                    ),
                    
                    React.createElement('div', { className: "mb-10 animate-slide-up" }, 
                        React.createElement('div', { className: "flex items-center space-x-3 mb-5 border-b-2 border-primary-500/30 pb-2" },
                            React.createElement(Icon, { name: "Calendar", className: "w-7 h-7 text-primary-400" }),
                            React.createElement('h2', { className: "text-2xl font-semibold text-white" }, "Due Today"),
                            React.createElement('span', { className: "px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full shadow" }, todaysTasks.length)
                        ),
                        todaysTasks.length === 0 ? 
                            React.createElement('div', { className: "empty-state-card" },
                                React.createElement(Icon, { name: "CheckCircle", className: "w-16 h-16 text-green-400 mx-auto mb-4" }),
                                React.createElement('h3', { className: "text-xl font-semibold text-white mb-2" }, "All caught up!"),
                                React.createElement('p', { className: "text-gray-400" }, "No tasks due today. Enjoy your break!")
                            ) :
                            React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" }, todaysTasks.map(renderTaskCard))
                    ),

                    React.createElement('div', { className: "mb-10 animate-slide-up animation-delay-200" },
                         React.createElement('div', { className: "flex items-center space-x-3 mb-5 border-b-2 border-purple-500/30 pb-2" },
                            React.createElement(Icon, { name: "Zap", className: "w-7 h-7 text-purple-400" }),
                            React.createElement('h2', { className: "text-2xl font-semibold text-white" }, "Upcoming Tasks"),
                             React.createElement('span', { className: "px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full shadow" }, upcomingTasks.length)
                        ),
                        upcomingTasks.length === 0 ? 
                            React.createElement('div', { className: "empty-state-card" },
                                React.createElement('h3', { className: "text-xl font-semibold text-white mb-2" }, "Nothing on the horizon yet."),
                                React.createElement('p', { className: "text-gray-400" }, "Add more tasks to see them here.")
                            ) :
                            React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" }, upcomingTasks.map(renderTaskCard))
                    ),

                    React.createElement('div', { className: "animate-slide-up animation-delay-400" },
                         React.createElement('div', { className: "flex items-center space-x-3 mb-5 border-b-2 border-gray-600/30 pb-2" },
                            React.createElement(Icon, { name: "Archive", className: "w-7 h-7 text-gray-500" }), 
                            React.createElement('h2', { className: "text-2xl font-semibold text-white" }, "Inactive / Past Due"),
                             React.createElement('span', { className: "px-3 py-1 bg-gray-700 text-white text-xs font-bold rounded-full shadow" }, inactiveOrPastDueTasks.length)
                        ),
                        inactiveOrPastDueTasks.length === 0 ?
                             React.createElement('div', { className: "empty-state-card" },
                                React.createElement('h3', { className: "text-xl font-semibold text-white mb-2" }, "All tasks are active and up-to-date!")
                             ) :
                             React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" }, inactiveOrPastDueTasks.map(renderTaskCard))
                    )
                )
            ),

            // Add Task Modal with Step Descriptions
            showAddModal && React.createElement('div', { className: "modal-overlay" },
                React.createElement('div', { className: "modal-content max-w-2xl w-full" },
                    React.createElement('div', {className:"modal-header"}, 
                        React.createElement('h2', {className:"text-xl font-bold text-white"}, "Add New Airdrop Task"), 
                        React.createElement('button', {onClick:()=>setShowAddModal(false), className:"modal-close-button"}, React.createElement(Icon, {name:"X", className:"w-6 h-6"}))
                    ),
                    React.createElement('div', {className:"modal-body"},
                        React.createElement('input', {type:"text", placeholder:"Task Name (e.g., ZkSync Daily Check-in)", value:newTaskForm.name, onChange:e=>setNewTaskForm({...newTaskForm, name:e.target.value}), className:"form-input mb-4"}),
                        React.createElement('textarea', {placeholder:"Description (optional, e.g., specific URL, steps summary)", value:newTaskForm.description, onChange:e=>setNewTaskForm({...newTaskForm, description:e.target.value}), className:"form-input form-textarea mb-4", rows:3}),
                        React.createElement('div', {className:"grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"},
                            React.createElement('div', null, React.createElement('label', {className:"form-label"}, "Interval"), React.createElement('select', {value: newTaskForm.interval, onChange: e => setNewTaskForm({...newTaskForm, interval: e.target.value as AirdropTask['interval']}), className:"form-select"}, ['hourly', 'daily', 'weekly', 'biweekly'].map(val => React.createElement('option', {key:val, value:val}, val.charAt(0).toUpperCase()+val.slice(1))))),
                            React.createElement('div', null, React.createElement('label', {className:"form-label"}, "Category"), React.createElement('input', {type:"text", placeholder:"e.g., DeFi, Gaming", value:newTaskForm.category, onChange:e=>setNewTaskForm({...newTaskForm, category:e.target.value}), className:"form-input"})),
                            React.createElement('div', null, React.createElement('label', {className:"form-label"}, "Priority"), React.createElement('select', {value: newTaskForm.priority, onChange: e => setNewTaskForm({...newTaskForm, priority: e.target.value as AirdropTask['priority']}), className:"form-select"}, ['low', 'medium', 'high'].map(val => React.createElement('option', {key:val, value:val}, val.charAt(0).toUpperCase()+val.slice(1)))))
                        ),
                        React.createElement('div', {className:"mb-4"}, 
                            React.createElement('label', {className:"form-label mb-2"}, "Task Steps"),
                            newTaskForm.steps.map((step, index) => (
                                React.createElement('div', { key: step.id || index, className: "p-3 bg-gray-700/40 rounded-lg mb-3 space-y-2 border border-gray-600/50" }, 
                                    React.createElement('div', {className: "flex items-center space-x-2"},
                                        React.createElement('span', { className: "step-number"}, index + 1),
                                        React.createElement('input', { type: "text", value: step.title, onChange: (e) => handleStepChangeInModal(index, 'title', e.target.value), className: "form-input flex-1 text-sm py-2", placeholder: `Step Title` }),
                                        React.createElement('button', { onClick: () => removeStepInputInModal(index), className: "btn-icon-danger"}, React.createElement(Icon, {name:"Trash2", className:"w-5 h-5"}))
                                    ),
                                    React.createElement('textarea', { value: step.description, onChange: (e) => handleStepChangeInModal(index, 'description', e.target.value), className: "form-input form-textarea text-sm py-2 w-full mt-1", placeholder: `Step Description (optional)`, rows: 2 })
                                )
                            )),
                            React.createElement('button', { onClick: addStepInputInModal, className: "btn btn-secondary-outline btn-sm mt-2 flex items-center space-x-1"},React.createElement(Icon, {name:"Plus", className:"w-4 h-4"}),React.createElement('span', null, "Add Step"))
                        ),
                        React.createElement('button', {onClick: addNewTask, className: "btn btn-primary w-full mt-2"}, "Create Task")
                    )
                )
            ),
            // Task Details Modal
            selectedTask && React.createElement('div', { className: "modal-overlay" },
                React.createElement('div', { className: "modal-content max-w-2xl w-full" },
                    React.createElement('div', {className:"modal-header"}, 
                        React.createElement('h2', {className:"text-xl font-bold text-white truncate", title: selectedTask.name}, selectedTask.name), 
                        React.createElement('button', {onClick:()=>setSelectedTask(null), className:"modal-close-button"}, React.createElement(Icon, {name:"X", className:"w-6 h-6"}))
                    ),
                    React.createElement('div', {className:"modal-body"},
                        React.createElement('p', {className:"text-gray-300 mb-4"}, selectedTask.description || React.createElement('em', null, "No description provided.")),
                        React.createElement('div', {className:"grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4"},
                            React.createElement('div', null, React.createElement('strong', {className:"modal-label"}, "Interval: "), React.createElement('span', {className:"modal-value"}, selectedTask.interval)),
                            React.createElement('div', null, React.createElement('strong', {className:"modal-label"}, "Priority: "), React.createElement('span', {className:"modal-value"}, selectedTask.priority)),
                            React.createElement('div', null, React.createElement('strong', {className:"modal-label"}, "Category: "), React.createElement('span', {className:"modal-value"}, selectedTask.category)),
                            React.createElement('div', null, React.createElement('strong', {className:"modal-label"}, "Streak: "), React.createElement('span', {className:"text-yellow-400 font-semibold"}, selectedTask.streak)),
                            React.createElement('div', {className:"col-span-2"}, React.createElement('strong', {className:"modal-label"}, "Last Completed: "), React.createElement('span', {className:"modal-value"}, selectedTask.lastCompleted ? new Date(selectedTask.lastCompleted).toLocaleString() : 'Never')),
                            React.createElement('div', {className:"col-span-2"}, React.createElement('strong', {className:"modal-label"}, "Next Due: "), React.createElement('span', {className:"modal-value font-semibold"}, new Date(selectedTask.nextDue).toLocaleString()))
                        ),
                        React.createElement('h3', {className:"text-lg font-semibold text-white pt-3 border-t border-gray-700/50 mt-3 mb-2"}, "Steps:"),
                        selectedTask.steps && selectedTask.steps.length > 0 ? 
                            React.createElement('ul', {className:"space-y-2"},
                                selectedTask.steps.sort((a,b)=>a.order-b.order).map((step, index) => (
                                    React.createElement('li', { key: step.id, className: `p-3 rounded-md flex items-start space-x-3 ${step.isCompleted ? 'bg-green-900/30 border-green-700/50' : 'bg-gray-700/40 border-gray-600/50'} border`},
                                        React.createElement('span', {className: `step-number-detail ${step.isCompleted ? 'bg-green-500' : 'bg-primary-500'}`}, step.order),
                                        React.createElement('div', {className: "flex-1"},
                                            React.createElement('span', {className:`font-medium ${step.isCompleted ? 'text-green-300 line-through' : 'text-gray-100'}`}, step.title),
                                            step.description && React.createElement('p', {className:`text-xs mt-0.5 ${step.isCompleted ? 'text-green-400/70 line-through' : 'text-gray-400'}`}, step.description)
                                        )
                                    )
                                ))
                            ) :
                            React.createElement('p', {className:"text-gray-500 italic"}, "No specific steps defined for this task."),
                        React.createElement('div', {className:"flex items-center space-x-3 mt-6 pt-4 border-t border-gray-700/50"},
                            React.createElement('button', {onClick:()=>completeTask(selectedTask.id!), className:"btn btn-success flex-1 flex items-center justify-center space-x-2"}, React.createElement(Icon, {name:"CheckCircle", className:"w-5 h-5"}), React.createElement('span', null, "Mark as Complete")),
                            React.createElement('button', {onClick:()=>toggleTaskActive(selectedTask.id!, selectedTask.isActive), className:`btn ${selectedTask.isActive ? 'btn-warning' : 'btn-secondary'} flex-1 flex items-center justify-center space-x-2`}, React.createElement(Icon, {name: selectedTask.isActive ? "PauseCircle" : "PlayCircle", className:"w-5 h-5"}), React.createElement('span', null, selectedTask.isActive ? 'Pause Task' : 'Resume Task')),
                            React.createElement('button', {onClick:()=>requestDeleteTask(selectedTask), className:"btn btn-danger flex items-center justify-center px-3"}, React.createElement(Icon, {name:"Trash2", className:"w-5 h-5"}))
                        )
                    )
                )
            ),
            // Delete Confirmation Modal
            showDeleteConfirmModal && taskToDelete && React.createElement('div', { className: "modal-overlay" },
                React.createElement('div', { className: "modal-content max-w-md w-full" }, 
                    React.createElement('div', {className:"modal-header"},
                        React.createElement('h3', {className:"text-lg font-semibold text-white"}, "Confirm Deletion")
                    ),
                    React.createElement('div', {className:"modal-body"},
                        React.createElement('p', {className:"text-gray-300 mb-6"}, 
                            `Are you sure you want to delete the task "${taskToDelete.name}"? This action cannot be undone.`
                        )
                    ),
                    React.createElement('div', {className:"modal-footer"},
                        React.createElement('button', {
                            onClick: () => { setShowDeleteConfirmModal(false); setTaskToDelete(null); },
                            className: "btn btn-secondary"
                        }, "Cancel"),
                        React.createElement('button', {
                            onClick: confirmDeleteTask,
                            className: "btn btn-danger"
                        }, "Delete Task")
                    )
                )
            )
        )
    )
  );
};


// --- Root App Component ---
const App = () => {
  const [user, setUser] = useState<any>(null); 
  const [authLoading, setAuthLoading] = useState(true);
  const [dbInstance, setDbInstance] = useState<any>(null); 
  const [authInstance, setAuthInstance] = useState<any>(null); 
  const [appError, setAppError] = useState<string | null>(null);

  const displayAppId = typeof __app_id !== 'undefined' ? __app_id : 'crypto-airdrop-manager';
  
  useEffect(() => {
    try {
      const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
      if (!firebaseConfigString) { 
        console.error("Firebase config (__firebase_config) is missing.");
        setAppError("Firebase configuration is missing. App cannot start.");
        setAuthLoading(false);
        return; 
      }
      const firebaseConfig = JSON.parse(firebaseConfigString);
      if (Object.keys(firebaseConfig).length === 0) { 
        setAppError("Firebase configuration is empty. App cannot start.");
        setAuthLoading(false);
        return; 
      }

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app); 
      const db = getFirestore(app);
      
      setDbInstance(db);
      setAuthInstance(auth); 
      setLogLevel('debug'); 

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => { 
        if (firebaseUser) {
          setUser(firebaseUser);
        } else {
          const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
          if (initialAuthToken) {
              try {
                  await signInWithCustomToken(auth, initialAuthToken);
              } catch (tokenError) {
                  console.error("Custom token sign-in failed:", tokenError);
                  setUser(null); 
              }
          } else {
              setUser(null);
          }
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } catch (e: any) { 
      console.error("Error initializing Firebase or Auth:", e);
      setAppError(`Initialization Error: ${e.message}`);
      setAuthLoading(false);
    }
  }, []);

  const handleSignOut = async () => { 
    if (authInstance) { 
      try {
        await signOut(authInstance);
        setUser(null);
      } catch (e: any) {
        console.error("Sign out error:", e);
        setAppError(`Sign out failed: ${e.message}`);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI && (window as any).electronAPI.onTriggerFirebaseSignOut) {
        const removeListener = (window as any).electronAPI.onTriggerFirebaseSignOut(handleSignOut);
        return () => { if (typeof removeListener === 'function') removeListener(); };
    }
  }, [authInstance]); 

  if (appError) { return React.createElement('div', { className: "min-h-screen bg-gray-900 text-red-400 flex items-center justify-center p-4 text-center" }, appError); }
  if (authLoading) { return React.createElement('div', { className: "min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center" }, React.createElement('p', { className: "text-xl animate-pulse" }, "Initializing App & Authenticating...")); }
  if (!dbInstance || !authInstance) { return React.createElement('div', { className: "min-h-screen bg-gray-900 text-yellow-400 flex items-center justify-center p-4 text-center" }, "Core services (Database/Auth) are unavailable. Please try again later."); }

  if (!user) {
    return React.createElement(AuthComponent, { onUserAuthenticated: setUser, db: dbInstance, authInstance: authInstance });
  }

  return (
    React.createElement(React.Fragment, null,
      React.createElement('div', {className: 'user-info text-xs bg-gray-800/80 backdrop-blur-lg border-b border-gray-700/50 text-gray-300 p-2 px-4 flex justify-between items-center sticky top-0 z-50'}, 
        React.createElement('span', null, `User: ${user.email || (user.isAnonymous ? "Anonymous" : `UID: ${user.uid}`)} (App ID: ${displayAppId})`),
        React.createElement('button', {onClick: handleSignOut, className:'bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-3 rounded-md transition duration-150 ease-in-out text-xs'}, 'Sign Out')
      ),
      React.createElement(AirdropManager, { userId: user.uid, db: dbInstance, authInstance: authInstance })
    )
  );
};

export default App;
