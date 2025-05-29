// File: src/components/AuthComponent.tsx
import React, { useState } from 'react';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInAnonymously 
} from 'firebase/auth';
import Icon from './Icon'; // Assuming Icon component is in the same directory or correctly pathed

interface AuthComponentProps {
  onUserAuthenticated: (user: any) => void; // Consider using firebase.User type if available
  authInstance: any; // Firebase Auth instance
}

const AuthComponent: React.FC<AuthComponentProps> = ({ onUserAuthenticated, authInstance }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(authInstance, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
      }
      onUserAuthenticated(userCredential.user);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    setError('');
    try {
        const userCredential = await signInAnonymously(authInstance);
        onUserAuthenticated(userCredential.user);
    } catch (e: any) {
        setError(e.message);
    }
    setLoading(false);
  };

  return (
    React.createElement('div', { id: "auth-container", className: "min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 sm:p-6" },
        React.createElement('div', { className: "w-full max-w-md bg-gray-800 shadow-2xl rounded-xl p-6 sm:p-10 space-y-6" },
            React.createElement('div', { className: "text-center" },
                React.createElement(Icon, { name: "Zap", className: "w-16 h-16 text-primary-500 mx-auto mb-4" }),
                React.createElement('h1', { className: "text-3xl font-bold text-white" }, isLogin ? 'Welcome Back!' : 'Create Account'),
                React.createElement('p', { className: "text-gray-400 mt-1" }, "Manage your airdrop tasks efficiently.")
            ),
            error && React.createElement('p', { className: "text-red-400 bg-red-500/10 p-3 rounded-md text-sm border border-red-500/30" }, error),
            React.createElement('input', { type: "email", placeholder: "Email Address", value: email, onChange: e => setEmail(e.target.value), className: "form-input bg-gray-700 border-gray-600 text-white placeholder-gray-400", disabled: loading }),
            React.createElement('input', { type: "password", placeholder: "Password", value: password, onChange: e => setPassword(e.target.value), className: "form-input bg-gray-700 border-gray-600 text-white placeholder-gray-400", disabled: loading }),
            React.createElement('button', { onClick: handleAuth, className: "w-full p-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-md shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70", disabled: loading },
                loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')
            ),
            React.createElement('button', { onClick: () => setIsLogin(!isLogin), className: "w-full text-sm text-primary-400 hover:text-primary-300 disabled:opacity-70", disabled: loading },
                isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'
            ),
            React.createElement('div', { className: "relative my-4" },
                React.createElement('div', { className: "absolute inset-0 flex items-center", "aria-hidden": "true" }, React.createElement('div', { className: "w-full border-t border-gray-700" })),
                React.createElement('div', { className: "relative flex justify-center text-sm" }, React.createElement('span', { className: "px-2 bg-gray-800 text-gray-500" }, "Or"))
            ),
            React.createElement('button', { onClick: handleAnonymousSignIn, className: "w-full p-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-md shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-70", disabled: loading },
                loading ? 'Processing...' : 'Continue Anonymously'
            )
        )
    )
  );
};

export default AuthComponent;
