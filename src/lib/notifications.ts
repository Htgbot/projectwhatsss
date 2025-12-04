let permission: NotificationPermission = 'default';

const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAUsgs/y2Ik2CBhkuezrrE0QDFCr5fG3Yh0HNo3V8Mx4KgUofszy2os7ChJcsejsq1gTC0af4fK+bCAFLILP8tiJNggYZLns66xNEAxQq+XxtmIdBzaN1fDMeCoFKH7M8tqLOwoSXLHo7KtYEwtGn+HyvmwgBSyCz/LYiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAUsgs/y2Ik2CBhkuezrrE0QDFCr5fG3Yh0HNo3V8Mx4KgUofszy2os7ChJcsejsq1gTC0af4fK+bCAFLILP8tiJNggYZLns66xNEAxQq+XxtmIdBzaN1fDMeCoFKH7M8tqLOwoSXLHo7KtYEwtGn+HyvmwgBSyCz/LYiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAUsgs/y2Ik2CBhkuezrrE0QDFCr5fG3Yh0HNo3V8Mx4KgUofszy2os7ChJcsejsq1gTC0af4fK+bCAFLILP8tiJNggYZLns66xNEAxQq+XxtmIdBzaN1fDMeCoFKH7M8tqLOwoSXLHo7KtYEwtGn+HyvmwgBSyCz/LYiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAUsgs/y2Ik2CBhkuezrrE0QDFCr5fG3Yh0HNo3V8Mx4KgUofszy2os7ChJcsejsq1gTC0af4fK+bCAFLILP8tiJNggYZLns66xNEAxQq+XxtmIdBzaN1fDMeCoFKH7M8tqLOwoSXLHo7KtYEwtGn+HyvmwgBSyCz/LYiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAUsgs/y2Ik2CBhkuezrrE0QDFCr5fG3Yh0HNo3V8Mx4KgUofszy2os7ChJcsejsq1gTC0af4fK+bCAFLILP8tiJNggYZLns66xNEAxQq+XxtmIdBzaN1fDMeCsFKH7M8tqLOwoSXLHo7KtYEwtGn+HyvmwgBSyCz/LYiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAUsgs/y2Ik2CBhkuezrrE0QDFCr5fG3Yh0HNo3V8Mx4KgUofszy2os7ChJcsejsq1gTC0af4fK+bCAFLILP8tiJNggYZLns66xNEAxQq+XxtmIdBzaN1fDMeCoFKH7M8tqLOwoSXLHo7KtYEwtGn+HyvmwgBSyCz/LYiTYIGGS57OusTRAMUKvl8bdiHQc2jdXwzHgqBSh+zPLaizsKElyx6OyrWBMLRp/h8r5sIAU=');

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    permission = 'granted';
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const result = await Notification.requestPermission();
      permission = result;

      if (result === 'granted') {
        console.log('Notification permission granted');
        testNotification();
      }

      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
}

function testNotification() {
  try {
    const notification = new Notification('Notifications Enabled', {
      body: 'You will now receive WhatsApp message notifications',
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 3000);
  } catch (error) {
    console.log('Could not show test notification:', error);
  }
}

export function playNotificationSound() {
  try {
    notificationSound.volume = 0.5;
    notificationSound.play().catch(err => {
      console.log('Could not play notification sound:', err);
    });
  } catch (error) {
    console.log('Notification sound not available');
  }
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return;
  }

  try {
    playNotificationSound();

    const notification = new Notification(title, {
      icon: '/icon.png',
      badge: '/icon.png',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      silent: false,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => {
      try {
        notification.close();
      } catch (e) {
        console.log('Notification already closed');
      }
    }, 5000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

export function canShowNotifications(): boolean {
  return permission === 'granted';
}
