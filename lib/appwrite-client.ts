import { Client, Account, Databases, Functions } from "appwrite";
import Constants from "expo-constants";

// Get environment variables
const endpoint = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_ENDPOINT || 
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 
  "";

const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID || 
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || 
  "";

const databaseId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_DATABASE_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ||
  "grovi-db";

if (!endpoint || !projectId) {
  console.warn(
    "Appwrite configuration missing. Please set EXPO_PUBLIC_APPWRITE_ENDPOINT and EXPO_PUBLIC_APPWRITE_PROJECT_ID in your .env file or app.json"
  );
}

// Initialize Appwrite client only if endpoint and projectId are provided
// This prevents "Invalid endpoint URL" errors when environment variables are not set
const client = new Client();
if (endpoint && projectId) {
  client.setEndpoint(endpoint).setProject(projectId);
}

// Initialize Account service
const account = new Account(client);

// Initialize Databases service
const databases = new Databases(client);
const functions = new Functions(client);

export { client, account, databases, functions, databaseId };

