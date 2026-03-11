/**
 * NotificationService
 * Handles Web Notifications API for OS-level alerts.
 */
export class NotificationService {
    static isSupported() {
        return 'Notification' in window;
    }

    static async requestPermission() {
        if (!this.isSupported()) return 'unsupported';

        if (Notification.permission === 'granted') return 'granted';

        try {
            const permission = await Notification.requestPermission();
            return permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return 'denied';
        }
    }

    /**
     * Shows an OS-level notification
     * @param {string} title 
     * @param {string} body 
     * @param {object} options 
     */
    static show(title, body, options = {}) {
        if (!this.isSupported()) {
            console.warn('⚠️ Notifications not supported in this browser.');
            return null;
        }
        
        if (Notification.permission !== 'granted') {
            console.warn('⚠️ Notification permission not granted. Call requestPermission() first.');
            return null;
        }

        try {
            const defaultOptions = {
                body: body,
                icon: 'img/logo.jpg', // Relative path from root
                badge: 'img/logo.jpg',
                vibrate: [200, 100, 200],
                tag: 'finance-alert',
                renotify: true,
                requireInteraction: false  // Auto-dismiss after 5s
            };

            const notification = new Notification(title, { ...defaultOptions, ...options });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            return notification;
        } catch (error) {
            console.error('❌ Error creating notification:', error);
            return null;
        }
    }

    /**
     * Specialized finance alerts
     */
    static alertBudget(amount, limit) {
        const percent = Math.round((amount / limit) * 100);
        this.show(
            '⚠️ Budget Warning',
            `You have spent ₹${amount.toLocaleString('en-IN')} (${percent}% of your ₹${limit.toLocaleString('en-IN')} budget).`
        );
    }

    static alertBehavior(message) {
        this.show(
            '🕵️ AI Insight',
            message
        );
    }
}
