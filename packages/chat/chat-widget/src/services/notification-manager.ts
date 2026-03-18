// A tiny base64-encoded WAV "ding" notification sound (440Hz sine, 150ms)
const NOTIFICATION_SOUND_BASE64 =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' +
  'oGAACAgICAgICAgICAgICAgICBgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6Cho' +
  'qOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX' +
  '2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/v///////v7+/fz7+vn' +
  '4+Pb19PPy8fDv7u3s6+rp6Ofm5eTj4uHg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxM' +
  'PCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPj' +
  'o2Mi4qJiIeGhYSDgoGAgICAgICAgICAgICAgIB/f35+fXx7enl4d3Z1dHNycXBvbm1sa2pp' +
  'aGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUBAPz49PDs6OTg3NjU' +
  '0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAQ' +
  'AAAAAAAAAAAAAAAAAAAQECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJyg' +
  'pKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BAQUJDREVGSElKS0xNTk9QUVJTVFVWV1hZWltcXV' +
  '5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn5/gICAgICAgICAgICAgICBgYKDh' +
  'IWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5' +
  'uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7' +
  'v8PHy8/T19vf4+fr7/P3+/v///////v7+/fz7+vn4+Pb19PPy8fDv7u3s6+rp6Ofm5eTj4u' +
  'Hg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66tr' +
  'KuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgICAgICAgICAg' +
  'ICAgIB/f35+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JR' +
  'UE9OTUxLSklIR0ZFRENCQUBAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0' +
  'cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAQAAAAAAAAAAAAAAAAAAAQECAwQFBgcICQoL' +
  'DA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0B' +
  'AQUJDREVGSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dX' +
  'Z3eHl6e3x9fn5/gICAgICAgICA';

/**
 * Manages sound notifications, browser title flashing, and desktop notifications.
 */
export class ChatNotificationManager {
  private audioElement: HTMLAudioElement | null = null;
  private originalTitle: string = '';
  private flashInterval: ReturnType<typeof setInterval> | null = null;
  private isFlashing = false;
  private soundEnabled = true;
  private desktopEnabled = false;
  private permissionGranted = false;

  constructor() {
    this.originalTitle = document.title;
    this.initAudio();
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  setDesktopEnabled(enabled: boolean): void {
    this.desktopEnabled = enabled;
    if (enabled) {
      this.requestDesktopPermission();
    }
  }

  /**
   * Play the notification sound if enabled.
   */
  playSound(): void {
    if (!this.soundEnabled || !this.audioElement) return;
    this.audioElement.currentTime = 0;
    this.audioElement.play().catch(() => {
      // Browser blocked autoplay — ignored
    });
  }

  /**
   * Flash the browser title with a "New message" indicator.
   */
  startTitleFlash(message = 'New message!'): void {
    // Clear any existing flash interval to prevent leaks
    this.stopTitleFlash();
    this.isFlashing = true;
    this.originalTitle = document.title;

    let showOriginal = false;
    this.flashInterval = setInterval(() => {
      document.title = showOriginal ? this.originalTitle : message;
      showOriginal = !showOriginal;
    }, 1000);
  }

  /**
   * Stop flashing and restore the original title.
   */
  stopTitleFlash(): void {
    if (!this.isFlashing) return;
    this.isFlashing = false;
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    document.title = this.originalTitle;
  }

  /**
   * Show a desktop notification if permitted.
   */
  showDesktopNotification(title: string, body: string, icon?: string): void {
    if (!this.desktopEnabled || !this.permissionGranted) return;
    if (typeof Notification === 'undefined') return;

    try {
      const notification = new Notification(title, { body, icon });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch {
      // Notification API unavailable
    }
  }

  /**
   * Notify on a new incoming message (plays sound + desktop notification + title flash).
   */
  notifyNewMessage(senderName?: string, content?: string): void {
    this.playSound();
    if (document.hidden) {
      this.startTitleFlash('New message!');
      this.showDesktopNotification(
        senderName ?? 'New message',
        content ?? 'You have a new message',
      );
    }
  }

  destroy(): void {
    this.stopTitleFlash();
    this.audioElement = null;
  }

  private initAudio(): void {
    try {
      this.audioElement = new Audio(NOTIFICATION_SOUND_BASE64);
      this.audioElement.volume = 0.5;
    } catch {
      // Audio not supported
    }
  }

  private requestDesktopPermission(): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return;
    }
    if (Notification.permission === 'denied') return;

    Notification.requestPermission().then((perm) => {
      this.permissionGranted = perm === 'granted';
    });
  }
}
