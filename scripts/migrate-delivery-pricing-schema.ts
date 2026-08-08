import * as dotenv from "dotenv";
import { Client, Databases } from "node-appwrite";

dotenv.config();

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "";
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || "";

if (!endpoint || !projectId || !apiKey) throw new Error("Missing Appwrite endpoint, project ID, or API key.");
if (databaseId !== "grovi_staging") throw new Error(`Refusing migration: database is '${databaseId}', expected 'grovi_staging'.`);

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const additions = [
  { collectionId: "orders", key: "deliveryDistanceMeters" },
  { collectionId: "orders", key: "deliveryDurationSeconds" },
  { collectionId: "orders", key: "deliveryPricingVersion", type: "string" },
  { collectionId: "store_orders", key: "deliveryDistanceMeters" },
  { collectionId: "store_orders", key: "deliveryDurationSeconds" },
];

async function verifyProject() {
  console.log(`Using configured Appwrite project: ${projectId}`);
  const database = await databases.get(databaseId);
  if (database.$id !== databaseId) throw new Error("Appwrite database ID mismatch.");
}

async function assertMissing(collectionId: string, key: string) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    throw new Error(`Refusing migration: ${collectionId}.${key} already exists.`);
  } catch (error: any) {
    if (error?.message?.startsWith("Refusing migration:")) throw error;
    if (error?.code !== 404) throw error;
  }
}

async function main() {
  await verifyProject();
  console.log(`Verified database: ${databaseId}`);
  for (const addition of additions) {
    await databases.getCollection(databaseId, addition.collectionId);
    await assertMissing(addition.collectionId, addition.key);
  }
  console.log("Verified all five target attributes are absent; applying additive attributes only.");

  for (const addition of additions) {
    if (addition.type === "string") {
      await databases.createStringAttribute(databaseId, addition.collectionId, addition.key, 50, false);
      console.log(`Created ${addition.collectionId}.${addition.key}: string, optional, size 50`);
    } else {
      await databases.createIntegerAttribute(databaseId, addition.collectionId, addition.key, false, 0);
      console.log(`Created ${addition.collectionId}.${addition.key}: integer, optional, min 0`);
    }
  }

  console.log("Delivery pricing schema migration complete. No documents or indexes were modified.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
