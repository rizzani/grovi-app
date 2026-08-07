import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { ID } from "appwrite";
import { databases, databaseId } from "./appwrite-client";
import { isSupportedAnalyticsEvent, removeUndefinedProperties, resolveSessionId } from "./analytics-core";
import type { AnalyticsEventName, AnalyticsEventProperties } from "./analytics-core";
export { AnalyticsEvent } from "./analytics-core";
export type { AnalyticsEventName, AnalyticsEventProperties } from "./analytics-core";

export const ANALYTICS_COLLECTION_ID = "analytics_events";

const SESSION_KEY = "@grovi:analytics_session_v1";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AnalyticsPayload {
  eventName: AnalyticsEventName;
  userId?: string;
  sessionId: string;
  propertiesJson: string;
  platform: string;
  appVersion: string;
  createdAt: string;
}

export async function getAnalyticsSessionId(now = Date.now()): Promise<string> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(SESSION_KEY);
  } catch { /* Recover by creating a new session. */ }
  const session = resolveSessionId(stored, now, ID.unique, SESSION_TTL_MS);
  if (session.isNew) try { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ id: session.id, createdAt: session.createdAt })); } catch { /* Best effort. */ }
  return session.id;
}

export async function buildAnalyticsPayload(
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties = {},
  userId?: string | null,
  now = new Date()
): Promise<AnalyticsPayload> {
  return {
    eventName,
    ...(userId ? { userId } : {}),
    sessionId: await getAnalyticsSessionId(now.getTime()),
    propertiesJson: JSON.stringify(removeUndefinedProperties(properties)),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version || "unknown",
    createdAt: now.toISOString(),
  };
}

/** Analytics is deliberately fire-and-forget: tracking must never affect a customer flow. */
export async function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties = {},
  userId?: string | null
): Promise<void> {
  if (!isSupportedAnalyticsEvent(eventName)) {
    if (__DEV__) console.warn("[Analytics] Ignoring unsupported event", eventName);
    return;
  }
  try {
    const payload = await buildAnalyticsPayload(eventName, properties, userId);
    await databases.createDocument(
      databaseId,
      ANALYTICS_COLLECTION_ID,
      ID.unique(),
      payload,
      // Collection-level create permission authorizes this request. Do not add
      // document permissions: an analytics event is append-only and private.
      []
    );
    if (__DEV__) console.log("[Analytics]", eventName, properties);
  } catch (error) {
    if (__DEV__) console.warn("[Analytics] Event was not recorded", { eventName, error });
  }
}
