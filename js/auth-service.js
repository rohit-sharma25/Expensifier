// js/auth-service.js
import { auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

export class AuthService {
    static onUserChange(callback) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('👤 User logged in:', user.email);
            } else {
                console.log('👤 User logged out or not authenticated');
            }
            callback(user);
        }, (error) => {
            console.error('❌ Auth state error:', error.code || error.message, error);
            callback(null);
        });
    }

    static getCurrentUser() {
        return auth.currentUser;
    }

    static async login() {
        const provider = new GoogleAuthProvider();
        try {
            console.log('🔐 Initiating Google login...');
            const result = await signInWithPopup(auth, provider);
            console.log('✅ Login successful:', result.user.email);
            return result.user;
        } catch (error) {
            console.error("❌ Login failed:", error.code || error.message, error);
            throw error;
        }
    }

    static async logout() {
        try {
            console.log('🔐 Logging out...');
            await signOut(auth);
            console.log('✅ Logout successful');
        } catch (error) {
            console.error("❌ Logout failed:", error.code || error.message, error);
            throw error;
        }
    }

    static isLocalOnly() {
        return localStorage.getItem('tracker_localOnly') === '1';
    }

    static setLocalOnly(value) {
        if (value) {
            console.log('💾 Switching to local-only mode');
            localStorage.setItem('tracker_localOnly', '1');
        } else {
            console.log('☁️ Disabling local-only mode');
            localStorage.removeItem('tracker_localOnly');
        }
    }
}
