import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { updatePushToken } from "./notification-preferences-service";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}

/**
 * Requests push notification permissions from the user
 * @returns Promise with permission status
 */
export async function requestPushPermissions(): Promise<PushNotificationPermissionStatus> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    let finalStatus = existingStatus;
    
    // Only ask if permissions have not already been determined
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return {
      granted: finalStatus === "granted",
      canAskAgain: finalStatus === Notifications.PermissionStatus.UNDETERMINED,
      status: finalStatus,
    };
  } catch (error: any) {
    console.error("Error requesting push permissions:", error);
    return {
      granted: false,
      canAskAgain: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
    };
  }
}

/**
 * Gets the current push notification permission status
 * @returns Promise with permission status
 */
export async function getPushPermissionStatus(): Promise<PushNotificationPermissionStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return {
      granted: status === "granted",
      canAskAgain: status === Notifications.PermissionStatus.UNDETERMINED,
      status,
    };
  } catch (error: any) {
    console.error("Error getting push permission status:", error);
    return {
      granted: false,
      canAskAgain: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
    };
  }
}

/**
 * Gets the Expo project ID from various sources
 * @returns Project ID or null if not found
 */
function getExpoProjectId(): string | null {
  // Try multiple sources for project ID
  const projectId =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_EXPO_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.manifest2?.extra?.eas?.projectId ||
    (Constants.manifest as any)?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ||
    null;

  return projectId;
}

/**
 * Checks if we're running in Expo Go (which has limitations)
 * @returns true if in Expo Go, false otherwise
 */
function isExpoGo(): boolean {
  try {
    // Check if Constants.appOwnership is 'expo' (Expo Go)
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
}

/**
 * Registers for push notifications and returns the token
 * @returns Promise with push token or null if not available
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if we're in Expo Go (which has limitations with push notifications)
    if (isExpoGo() && Platform.OS === 'android') {
      console.warn(
        "Android push notifications are not supported in Expo Go. " +
        "Please use a development build to test push notifications. " +
        "See: https://docs.expo.dev/develop/development-builds/introduction/"
      );
      return null;
    }

    // Check permissions first
    const permissionStatus = await getPushPermissionStatus();
    
    if (!permissionStatus.granted) {
      console.log("Push notifications not permitted");
      return null;
    }

    // Get the push token
    const projectId = getExpoProjectId();
    
    if (!projectId) {
      console.warn(
        "Expo project ID not found. Push notifications may not work. " +
        "Please set EXPO_PUBLIC_EXPO_PROJECT_ID in your app.json or .env file, " +
        "or ensure your EAS project is configured."
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    return tokenData.data;
  } catch (error: any) {
    // Check for specific Expo Go error
    if (error.message?.includes("Expo Go") || error.message?.includes("development build")) {
      console.warn(
        "Push notifications require a development build. " +
        "Expo Go has limited support. See: https://docs.expo.dev/develop/development-builds/introduction/"
      );
      return null;
    }
    
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Registers push token for a user and stores it in Appwrite
 * @param userId - User ID
 * @returns Promise with push token or null if not available
 */
export async function registerAndStorePushToken(
  userId: string
): Promise<string | null> {
  try {
    // Check if we're in Expo Go (which has limitations with push notifications)
    if (isExpoGo() && Platform.OS === 'android') {
      console.warn(
        "Android push notifications are not supported in Expo Go. " +
        "Please use a development build to test push notifications."
      );
      return null;
    }

    // Request permissions if needed
    const permissionStatus = await requestPushPermissions();
    
    if (!permissionStatus.granted) {
      console.log("Push notification permissions not granted");
      return null;
    }

    // Get the push token
    const token = await registerForPushNotifications();
    
    if (!token) {
      return null;
    }

    // Store the token in Appwrite
    await updatePushToken(userId, token);
    
    return token;
  } catch (error: any) {
    // Check for specific Expo Go error
    if (error.message?.includes("Expo Go") || error.message?.includes("development build")) {
      console.warn(
        "Push notifications require a development build. " +
        "Expo Go has limited support."
      );
      return null;
    }
    
    console.error("Error registering and storing push token:", error);
    return null;
  }
}

/**
 * Initializes push notifications for a user
 * This should be called on app start when user is authenticated
 * @param userId - User ID
 * @param pushEnabled - Whether push notifications are enabled in preferences
 * @returns Promise with push token or null
 */
export async function initializePushNotifications(
  userId: string,
  pushEnabled: boolean
): Promise<string | null> {
  try {
    if (!pushEnabled) {
      // If push is disabled, don't register
      return null;
    }

    // Check if we already have permissions
    const permissionStatus = await getPushPermissionStatus();
    
    if (permissionStatus.granted) {
      // We have permissions, get and store the token
      return await registerAndStorePushToken(userId);
    }

    // Permissions not granted yet - return null
    // User will need to enable push in settings first
    return null;
  } catch (error: any) {
    console.error("Error initializing push notifications:", error);
    return null;
  }
}

/**
 * Sets up notification listeners for foreground notifications
 * @param onNotificationReceived - Callback when notification is received
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void
) {
  // Listener for notifications received while app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    }
  );

  // Listener for when user taps on a notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      // Handle notification tap
      console.log("Notification tapped:", response);
    }
  );

  return {
    foregroundSubscription,
    responseSubscription,
    remove: () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    },
  };
}

/**
 * Clears the push token (when user disables push)
 * @param userId - User ID
 */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    await updatePushToken(userId, null);
  } catch (error: any) {
    console.error("Error clearing push token:", error);
  }
}
