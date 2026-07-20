import { Client, Databases, ID, Permission, Role } from "appwrite";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";

// Load environment variables from .env file
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Try .env.local as fallback
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }
}

// Get environment variables
const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "";
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || "grovi-db";

if (!endpoint || !projectId || !apiKey) {
  console.error("Missing required environment variables:");
  console.error("  EXPO_PUBLIC_APPWRITE_ENDPOINT:", endpoint ? "✓" : "✗");
  console.error("  EXPO_PUBLIC_APPWRITE_PROJECT_ID:", projectId ? "✓" : "✗");
  console.error("  APPWRITE_API_KEY:", apiKey ? "✓" : "✗");
  process.exit(1);
}

// Helper function to make API requests to Appwrite
async function appwriteRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Ensure endpoint ends with /v1 if not already present
    const baseUrl = endpoint.endsWith("/v1") ? endpoint : `${endpoint}/v1`;
    const fullUrl = `${baseUrl}${path}`;
    const url = new URL(fullUrl);
    const isHttps = url.protocol === "https:";
    const httpModule = isHttps ? https : http;

    const postData = body ? JSON.stringify(body) : undefined;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
      },
    };

    const req = httpModule.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const error: any = new Error(parsed.message || "Request failed");
            error.code = res.statusCode;
            error.response = parsed;
            reject(error);
          }
        } catch (e) {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          }
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Initialize Appwrite client for document operations
const client = new Client().setEndpoint(endpoint).setProject(projectId);
const databases = new Databases(client);

type SchemaAttribute =
  | { key: string; type: "string"; size: number; required: boolean }
  | { key: string; type: "integer"; required: boolean; min?: number }
  | { key: string; type: "datetime"; required: boolean }
  | { key: string; type: "enum"; required: boolean; elements: string[] };

type SchemaIndex = {
  key: string;
  type: "key" | "unique";
  attributes: string[];
  orders: ("ASC" | "DESC")[];
};

type CollectionSchema = {
  id: string;
  name: string;
  attributes: SchemaAttribute[];
  indexes: SchemaIndex[];
};

const orderCollectionSchemas: CollectionSchema[] = [
  {
    id: "orders",
    name: "Orders",
    attributes: [
      { key: "userId", type: "string", size: 36, required: true },
      { key: "orderNumber", type: "string", size: 36, required: true },
      { key: "idempotencyKey", type: "string", size: 255, required: true },
      { key: "requestFingerprint", type: "string", size: 128, required: true },
      { key: "status", type: "string", size: 30, required: true },
      { key: "statusReason", type: "string", size: 500, required: false },
      { key: "paymentMethod", type: "string", size: 50, required: true },
      { key: "paymentStatus", type: "string", size: 30, required: true },
      { key: "currency", type: "string", size: 3, required: true },
      { key: "addressId", type: "string", size: 36, required: true },
      { key: "addressLabel", type: "string", size: 30, required: true },
      { key: "deliveryParish", type: "string", size: 100, required: true },
      { key: "deliveryCommunity", type: "string", size: 60, required: true },
      { key: "deliveryStreet", type: "string", size: 60, required: false },
      { key: "deliveryHouseDetails", type: "string", size: 30, required: false },
      { key: "deliveryLandmarkDirections", type: "string", size: 240, required: true },
      { key: "deliveryContactPhone", type: "string", size: 20, required: true },
      { key: "itemCount", type: "integer", required: true, min: 1 },
      { key: "storeCount", type: "integer", required: true, min: 1 },
      { key: "subtotalJmdCents", type: "integer", required: true, min: 0 },
      { key: "deliveryFeeJmdCents", type: "integer", required: true, min: 0 },
      { key: "discountJmdCents", type: "integer", required: true, min: 0 },
      { key: "totalJmdCents", type: "integer", required: true, min: 0 },
      { key: "schemaVersion", type: "integer", required: true, min: 1 },
      { key: "cartUpdatedAt", type: "datetime", required: false },
      { key: "placedAt", type: "datetime", required: true },
      { key: "confirmedAt", type: "datetime", required: false },
      { key: "deliveredAt", type: "datetime", required: false },
      { key: "cancelledAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "idx_idempotencyKey", type: "unique", attributes: ["idempotencyKey"], orders: ["ASC"] },
      { key: "idx_orderNumber", type: "unique", attributes: ["orderNumber"], orders: ["ASC"] },
      { key: "idx_userId", type: "key", attributes: ["userId"], orders: ["ASC"] },
      { key: "idx_user_placed", type: "key", attributes: ["userId", "placedAt"], orders: ["ASC", "DESC"] },
      { key: "idx_status", type: "key", attributes: ["status"], orders: ["ASC"] },
    ],
  },
  {
    id: "store_orders",
    name: "Store Orders",
    attributes: [
      { key: "orderId", type: "string", size: 36, required: true },
      { key: "userId", type: "string", size: 36, required: true },
      { key: "storeLocationId", type: "string", size: 255, required: true },
      { key: "storeName", type: "string", size: 255, required: true },
      { key: "storeBrandId", type: "string", size: 255, required: false },
      { key: "status", type: "string", size: 30, required: true },
      { key: "statusReason", type: "string", size: 500, required: false },
      { key: "itemCount", type: "integer", required: true, min: 1 },
      { key: "subtotalJmdCents", type: "integer", required: true, min: 0 },
      { key: "deliveryFeeJmdCents", type: "integer", required: true, min: 0 },
      { key: "discountJmdCents", type: "integer", required: true, min: 0 },
      { key: "totalJmdCents", type: "integer", required: true, min: 0 },
      { key: "acceptedAt", type: "datetime", required: false },
      { key: "dispatchedAt", type: "datetime", required: false },
      { key: "deliveredAt", type: "datetime", required: false },
      { key: "cancelledAt", type: "datetime", required: false },
    ],
    indexes: [
      { key: "idx_orderId", type: "key", attributes: ["orderId"], orders: ["ASC"] },
      { key: "idx_storeLocationId", type: "key", attributes: ["storeLocationId"], orders: ["ASC"] },
      { key: "idx_store_status", type: "key", attributes: ["storeLocationId", "status"], orders: ["ASC", "ASC"] },
    ],
  },
  {
    id: "order_items",
    name: "Order Items",
    attributes: [
      { key: "orderId", type: "string", size: 36, required: true },
      { key: "storeOrderId", type: "string", size: 36, required: true },
      { key: "userId", type: "string", size: 36, required: true },
      { key: "productId", type: "string", size: 255, required: true },
      { key: "storeLocationId", type: "string", size: 255, required: true },
      { key: "sku", type: "string", size: 255, required: true },
      { key: "title", type: "string", size: 255, required: true },
      { key: "brand", type: "string", size: 255, required: false },
      { key: "imageUrl", type: "string", size: 2048, required: false },
      { key: "unitSize", type: "string", size: 100, required: false },
      { key: "quantity", type: "integer", required: true, min: 1 },
      { key: "unitPriceJmdCents", type: "integer", required: true, min: 0 },
      { key: "lineTotalJmdCents", type: "integer", required: true, min: 0 },
    ],
    indexes: [
      { key: "idx_orderId", type: "key", attributes: ["orderId"], orders: ["ASC"] },
      { key: "idx_storeOrderId", type: "key", attributes: ["storeOrderId"], orders: ["ASC"] },
      { key: "idx_productId", type: "key", attributes: ["productId"], orders: ["ASC"] },
    ],
  },
];

function arraysEqual(left: unknown[] = [], right: unknown[] = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function waitForSchemaResource(pathname: string, label: string): Promise<any> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const resource = await appwriteRequest("GET", pathname);
    if (!resource.status || resource.status === "available") return resource;
    if (resource.status === "failed") throw new Error(`${label} creation failed: ${resource.error || "unknown error"}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function verifyAttribute(existing: any, expected: SchemaAttribute, collectionId: string) {
  const errors: string[] = [];
  if (existing.type !== expected.type) errors.push(`type ${existing.type} != ${expected.type}`);
  if (Boolean(existing.required) !== expected.required) errors.push(`required ${existing.required} != ${expected.required}`);
  if (expected.type === "string" && existing.size !== expected.size) errors.push(`size ${existing.size} != ${expected.size}`);
  if (expected.type === "integer" && expected.min !== undefined && existing.min !== expected.min) errors.push(`min ${existing.min} != ${expected.min}`);
  if (expected.type === "enum" && !arraysEqual(existing.elements, expected.elements)) errors.push("enum elements differ");
  if (errors.length) throw new Error(`Cannot non-destructively reconcile ${collectionId}.${expected.key}: ${errors.join(", ")}`);
}

async function ensureSchemaAttribute(collectionId: string, attribute: SchemaAttribute) {
  const base = `/databases/${databaseId}/collections/${collectionId}/attributes`;
  try {
    const existing = await appwriteRequest("GET", `${base}/${attribute.key}`);
    verifyAttribute(existing, attribute, collectionId);
    await waitForSchemaResource(`${base}/${attribute.key}`, `${collectionId}.${attribute.key}`);
    console.log(`  - Attribute '${attribute.key}' already exists and matches`);
    return;
  } catch (error: any) {
    if (error.code !== 404) throw error;
  }
  const { type, ...body } = attribute;
  await appwriteRequest("POST", `${base}/${type}`, body);
  await waitForSchemaResource(`${base}/${attribute.key}`, `${collectionId}.${attribute.key}`);
  console.log(`  ✓ Created attribute '${attribute.key}' (${type})`);
}

async function ensureSchemaIndex(collectionId: string, index: SchemaIndex) {
  const base = `/databases/${databaseId}/collections/${collectionId}/indexes`;
  try {
    const existing = await appwriteRequest("GET", `${base}/${index.key}`);
    if (existing.type !== index.type || !arraysEqual(existing.attributes, index.attributes) || !arraysEqual(existing.orders, index.orders)) {
      throw new Error(`Cannot non-destructively reconcile index ${collectionId}.${index.key}`);
    }
    await waitForSchemaResource(`${base}/${index.key}`, `${collectionId}.${index.key}`);
    console.log(`  - Index '${index.key}' already exists and matches`);
    return;
  } catch (error: any) {
    if (error.code !== 404) throw error;
  }
  await appwriteRequest("POST", base, index);
  await waitForSchemaResource(`${base}/${index.key}`, `${collectionId}.${index.key}`);
  console.log(`  ✓ Created index '${index.key}'`);
}

async function ensureOrderCollections() {
  console.log("\n📦 Configuring order collections...");
  for (const schema of orderCollectionSchemas) {
    const path = `/databases/${databaseId}/collections/${schema.id}`;
    try {
      await appwriteRequest("GET", path);
      console.log(`✓ Collection '${schema.id}' already exists`);
    } catch (error: any) {
      if (error.code !== 404) throw error;
      await appwriteRequest("POST", `/databases/${databaseId}/collections`, {
        collectionId: schema.id,
        name: schema.name,
        permissions: [],
        documentSecurity: true,
        enabled: true,
      });
      console.log(`✓ Created collection '${schema.id}'`);
    }
    await appwriteRequest("PUT", path, { name: schema.name, permissions: [], documentSecurity: true, enabled: true });
    for (const attribute of schema.attributes) await ensureSchemaAttribute(schema.id, attribute);
    for (const index of schema.indexes) await ensureSchemaIndex(schema.id, index);
  }
}

async function setupDatabase() {
  try {
    console.log("🚀 Starting database setup...\n");

    // Step 1: Create or get database
    let db;
    try {
      db = await appwriteRequest("GET", `/databases/${databaseId}`);
      console.log(`✓ Database '${databaseId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          db = await appwriteRequest("POST", "/databases", {
            databaseId,
            name: "Grovi Database",
          });
          console.log(`✓ Created database '${databaseId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create database: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 2: Create profiles collection
    const profilesCollectionId = "profiles";
    let profilesCollection;
    try {
      profilesCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${profilesCollectionId}`
      );
      console.log(`✓ Collection '${profilesCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          profilesCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: profilesCollectionId,
              name: "Profiles",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${profilesCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 3: Create profiles attributes
    const profilesStringAttributes = [
      { key: "userId", size: 36, required: true },
      { key: "firstName", size: 255, required: false },
      { key: "lastName", size: 255, required: false },
      { key: "name", size: 255, required: false }, // Kept for backward compatibility
      { key: "phone", size: 20, required: true },
      { key: "email", size: 255, required: true },
    ];

    for (const attr of profilesStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${profilesCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string)`);
        // Wait for attribute to be ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Note: createdAt is automatically handled by Appwrite, no need to create it

    // Step 4: Create profiles indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${profilesCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created unique index 'idx_userId' on profiles`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 5: Set profiles permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${profilesCollectionId}`,
        {
          name: "Profiles",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${profilesCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 6: Create addresses collection
    const addressesCollectionId = "addresses";
    let addressesCollection;
    try {
      addressesCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${addressesCollectionId}`
      );
      console.log(`✓ Collection '${addressesCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          addressesCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: addressesCollectionId,
              name: "Addresses",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${addressesCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 7: Create addresses attributes
    const addressesStringAttributes = [
      { key: "userId", size: 36, required: true },
      { key: "label", size: 30, required: true }, // Address label (e.g. Home, Work)
      { key: "parish", size: 100, required: true }, // Jamaica parish
      { key: "community", size: 60, required: true }, // Community/Area
      { key: "street", size: 60, required: false }, // Street/Scheme/Road (optional)
      { key: "houseDetails", size: 30, required: false }, // House/Lot/Apt (optional)
      { key: "landmarkDirections", size: 240, required: true }, // Landmark/Directions (critical)
      { key: "contactPhone", size: 20, required: false }, // Contact phone (optional)
    ];

    for (const attr of addressesStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${addressesCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string, required: ${attr.required})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Create default boolean attribute
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${addressesCollectionId}/attributes/boolean`,
        {
          key: "default",
          required: true,
        }
      );
      console.log(`  ✓ Created attribute 'default' (boolean)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'default' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'default': ${error.message}`);
      }
    }

    // Note: createdAt is automatically handled by Appwrite, no need to create it

    // Step 8: Create addresses indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${addressesCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on addresses`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 9: Set addresses permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${addressesCollectionId}`,
        {
          name: "Addresses",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${addressesCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 10: Create audit_logs collection
    const auditLogsCollectionId = "audit_logs";
    let auditLogsCollection;
    try {
      auditLogsCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${auditLogsCollectionId}`
      );
      console.log(`✓ Collection '${auditLogsCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          auditLogsCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: auditLogsCollectionId,
              name: "Audit Logs",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${auditLogsCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 11: Create audit_logs attributes
    const auditLogsStringAttributes = [
      { key: "userId", size: 36, required: true },
      { key: "eventType", size: 100, required: true },
      { key: "metadata", size: 2000, required: false }, // JSON string
      { key: "timestamp", size: 50, required: true }, // ISO 8601 format
    ];

    for (const attr of auditLogsStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${auditLogsCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Note: createdAt is automatically handled by Appwrite, no need to create it

    // Step 12: Create audit_logs indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${auditLogsCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on audit_logs`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${auditLogsCollectionId}/indexes`,
        {
          key: "idx_eventType",
          type: "key",
          attributes: ["eventType"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_eventType' on audit_logs`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_eventType' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${auditLogsCollectionId}/indexes`,
        {
          key: "idx_timestamp",
          type: "key",
          attributes: ["timestamp"],
          orders: ["DESC"],
        }
      );
      console.log(`  ✓ Created index 'idx_timestamp' on audit_logs`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_timestamp' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 13: Set audit_logs permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${auditLogsCollectionId}`,
        {
          name: "Audit Logs",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${auditLogsCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 14: Create payment_methods collection
    const paymentMethodsCollectionId = "payment_methods";
    let paymentMethodsCollection;
    try {
      paymentMethodsCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${paymentMethodsCollectionId}`
      );
      console.log(`✓ Collection '${paymentMethodsCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          paymentMethodsCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: paymentMethodsCollectionId,
              name: "Payment Methods",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${paymentMethodsCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 15: Create payment_methods attributes
    const paymentMethodsStringAttributes = [
      { key: "userId", size: 36, required: true },
      { key: "type", size: 30, required: true }, // "card", "cash_on_delivery", "other"
      { key: "brand", size: 30, required: false }, // Card brand (e.g., "Visa", "Mastercard")
      { key: "last4", size: 4, required: false }, // Last 4 digits of card
      { key: "maskedNumber", size: 20, required: false }, // Full masked number (e.g., "•••• 4242")
      { key: "label", size: 50, required: false }, // Optional label (e.g., "My Visa Card")
    ];

    for (const attr of paymentMethodsStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${paymentMethodsCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string, required: ${attr.required})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Note: createdAt is automatically handled by Appwrite, no need to create it

    // Step 16: Create payment_methods indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${paymentMethodsCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on payment_methods`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 17: Set payment_methods permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${paymentMethodsCollectionId}`,
        {
          name: "Payment Methods",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${paymentMethodsCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 18: Create user_preferences collection
    const userPreferencesCollectionId = "user_preferences";
    let userPreferencesCollection;
    try {
      userPreferencesCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${userPreferencesCollectionId}`
      );
      console.log(`✓ Collection '${userPreferencesCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          userPreferencesCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: userPreferencesCollectionId,
              name: "User Preferences",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${userPreferencesCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 19: Create user_preferences attributes
    const userPreferencesStringAttributes = [
      { key: "userId", size: 36, required: true },
    ];

    for (const attr of userPreferencesStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${userPreferencesCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Create array attributes for preferences
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${userPreferencesCollectionId}/attributes/string`,
        {
          key: "dietaryPreferences",
          size: 1000,
          required: false,
          array: true,
        }
      );
      console.log(`  ✓ Created attribute 'dietaryPreferences' (string array)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'dietaryPreferences' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'dietaryPreferences': ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${userPreferencesCollectionId}/attributes/string`,
        {
          key: "categoryPreferences",
          size: 1000,
          required: false,
          array: true,
        }
      );
      console.log(`  ✓ Created attribute 'categoryPreferences' (string array)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'categoryPreferences' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'categoryPreferences': ${error.message}`);
      }
    }

    // Note: createdAt and updatedAt are automatically handled by Appwrite, no need to create them

    // Step 20: Create user_preferences indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${userPreferencesCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on user_preferences`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 21: Set user_preferences permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${userPreferencesCollectionId}`,
        {
          name: "User Preferences",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${userPreferencesCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 22: Create notification_preferences collection
    const notificationPreferencesCollectionId = "notification_preferences";
    let notificationPreferencesCollection;
    try {
      notificationPreferencesCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${notificationPreferencesCollectionId}`
      );
      console.log(`✓ Collection '${notificationPreferencesCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          notificationPreferencesCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: notificationPreferencesCollectionId,
              name: "Notification Preferences",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${notificationPreferencesCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 19: Create notification_preferences attributes
    const notificationPreferencesStringAttributes = [
      { key: "userId", size: 36, required: true },
      { key: "pushToken", size: 500, required: false }, // Expo push token
    ];

    for (const attr of notificationPreferencesStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${notificationPreferencesCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string, required: ${attr.required})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Create boolean attributes for notification preferences
    const notificationPreferencesBooleanAttributes = [
      { key: "orderUpdatesEnabled", required: true },
      { key: "promotionsEnabled", required: true },
      { key: "pushEnabled", required: true },
      { key: "emailEnabled", required: true },
      { key: "smsEnabled", required: true },
    ];

    for (const attr of notificationPreferencesBooleanAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${notificationPreferencesCollectionId}/attributes/boolean`,
          {
            key: attr.key,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (boolean, required: ${attr.required})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Note: createdAt and updatedAt are automatically handled by Appwrite, no need to create them

    // Step 24: Create notification_preferences indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${notificationPreferencesCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on notification_preferences`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 25: Set notification_preferences permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${notificationPreferencesCollectionId}`,
        {
          name: "Notification Preferences",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${notificationPreferencesCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 26: Create store_location_product collection
    const storeLocationProductCollectionId = "store_location_product";
    let storeLocationProductCollection;
    try {
      storeLocationProductCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}`
      );
      console.log(`✓ Collection '${storeLocationProductCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          storeLocationProductCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: storeLocationProductCollectionId,
              name: "Store Location Product",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ],
            }
          );
          console.log(`✓ Created collection '${storeLocationProductCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 27: Create store_location_product attributes
    const storeLocationProductStringAttributes = [
      { key: "product_id", size: 255, required: true },
      { key: "store_location_id", size: 255, required: true },
      { key: "brand_id", size: 255, required: true },
      { key: "source_key", size: 50, required: false },
      { key: "external_id", size: 255, required: false },
      { key: "external_url", size: 2048, required: false },
      { key: "price_currency", size: 3, required: false },
      { key: "category_leaf_id", size: 255, required: false },
      { key: "content_hash", size: 64, required: false },
    ];

    for (const attr of storeLocationProductStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string, required: ${attr.required})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Create category_path_ids as string array
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/attributes/string`,
        {
          key: "category_path_ids",
          size: 255,
          required: false,
          array: true,
        }
      );
      console.log(`  ✓ Created attribute 'category_path_ids' (string array)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'category_path_ids' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'category_path_ids': ${error.message}`);
      }
    }

    // Create integer attribute for price_jmd_cents (required)
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/attributes/integer`,
        {
          key: "price_jmd_cents",
          required: true,
        }
      );
      console.log(`  ✓ Created attribute 'price_jmd_cents' (integer, required)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'price_jmd_cents' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'price_jmd_cents': ${error.message}`);
      }
    }

    // Create boolean attribute for in_stock (required)
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/attributes/boolean`,
        {
          key: "in_stock",
          required: true,
        }
      );
      console.log(`  ✓ Created attribute 'in_stock' (boolean, required)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'in_stock' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'in_stock': ${error.message}`);
      }
    }

    // Create datetime attributes
    const storeLocationProductDatetimeAttributes = [
      { key: "first_seen_at", required: false },
      { key: "last_seen_at", required: false },
    ];

    for (const attr of storeLocationProductDatetimeAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/attributes/datetime`,
          {
            key: attr.key,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (datetime, required: ${attr.required})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Step 28: Create store_location_product indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_product_location",
          type: "key",
          attributes: ["product_id", "store_location_id"],
          orders: ["ASC", "ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_product_location' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_product_location' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_store_location",
          type: "key",
          attributes: ["store_location_id"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_store_location' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_store_location' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_brand",
          type: "key",
          attributes: ["brand_id"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_brand' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_brand' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_in_stock",
          type: "key",
          attributes: ["in_stock"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_in_stock' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_in_stock' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_store_stock",
          type: "key",
          attributes: ["store_location_id", "in_stock"],
          orders: ["ASC", "ASC"],
        }
      );
      console.log(`  ✓ Created composite index 'idx_store_stock' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_store_stock' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_category_leaf",
          type: "key",
          attributes: ["category_leaf_id"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_category_leaf' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_category_leaf' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}/indexes`,
        {
          key: "idx_price",
          type: "key",
          attributes: ["price_jmd_cents"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_price' on store_location_product`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_price' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 29: Set store_location_product permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${storeLocationProductCollectionId}`,
        {
          name: "Store Location Product",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ],
        }
      );
      console.log(`  ✓ Updated permissions for '${storeLocationProductCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 30: Create indexes for store_location collection (if it exists)
    const storeLocationCollectionId = "store_location";
    console.log(`\n📦 Checking for '${storeLocationCollectionId}' collection...`);
    try {
      // Check if collection exists
      await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${storeLocationCollectionId}`
      );
      console.log(`✓ Collection '${storeLocationCollectionId}' exists, creating indexes...`);

      // Create index on is_active
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${storeLocationCollectionId}/indexes`,
          {
            key: "idx_is_active",
            type: "key",
            attributes: ["is_active"],
            orders: ["ASC"],
          }
        );
        console.log(`  ✓ Created index 'idx_is_active' on ${storeLocationCollectionId}`);
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Index 'idx_is_active' already exists on ${storeLocationCollectionId}`);
        } else {
          console.error(`  ✗ Failed to create index 'idx_is_active': ${error.message}`);
        }
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`  - Collection '${storeLocationCollectionId}' does not exist (skipping indexes)`);
      } else {
        console.warn(`  ⚠️  Could not check/create indexes for '${storeLocationCollectionId}': ${error.message}`);
      }
    }

    // Step 31: Create indexes for products collection (if it exists)
    const productsCollectionId = "products";
    console.log(`\n📦 Checking for '${productsCollectionId}' collection...`);
    try {
      // Check if collection exists
      await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${productsCollectionId}`
      );
      console.log(`✓ Collection '${productsCollectionId}' exists, creating indexes...`);

      // Create full-text index on title (if it doesn't already exist)
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${productsCollectionId}/indexes`,
          {
            key: "idx_title_fulltext",
            type: "fulltext",
            attributes: ["title"],
          }
        );
        console.log(`  ✓ Created full-text index 'idx_title_fulltext' on ${productsCollectionId}.title`);
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Full-text index 'idx_title_fulltext' already exists on ${productsCollectionId}`);
        } else {
          console.warn(`  ⚠️  Could not create full-text index on title: ${error.message}`);
          console.log(`  (Note: Full-text index may already exist with a different name)`);
        }
      }

      // Add country_of_origin attribute to products collection (STORY-CUS-007-B)
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${productsCollectionId}/attributes/string`,
          {
            key: "country_of_origin",
            size: 100,
            required: false,
          }
        );
        console.log(`  ✓ Created attribute 'country_of_origin' on ${productsCollectionId}`);
        // Wait for attribute to be ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute 'country_of_origin' already exists on ${productsCollectionId}`);
        } else {
          console.warn(`  ⚠️  Could not create attribute 'country_of_origin': ${error.message}`);
        }
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`  - Collection '${productsCollectionId}' does not exist (skipping indexes and attributes)`);
      } else {
        console.warn(`  ⚠️  Could not check/create indexes for '${productsCollectionId}': ${error.message}`);
      }
    }

    // Step 32: Create indexes for categories collection (if it exists)
    const categoriesCollectionId = "categories";
    console.log(`\n📦 Checking for '${categoriesCollectionId}' collection...`);
    try {
      // Check if collection exists
      await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${categoriesCollectionId}`
      );
      console.log(`✓ Collection '${categoriesCollectionId}' exists, creating indexes...`);

      // Create full-text index on name (recommended for search performance)
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${categoriesCollectionId}/indexes`,
          {
            key: "idx_name_fulltext",
            type: "fulltext",
            attributes: ["name"],
          }
        );
        console.log(`  ✓ Created full-text index 'idx_name_fulltext' on ${categoriesCollectionId}.name`);
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Full-text index 'idx_name_fulltext' already exists on ${categoriesCollectionId}`);
        } else {
          console.warn(`  ⚠️  Could not create full-text index on name: ${error.message}`);
        }
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`  - Collection '${categoriesCollectionId}' does not exist (skipping indexes)`);
      } else {
        console.warn(`  ⚠️  Could not check/create indexes for '${categoriesCollectionId}': ${error.message}`);
      }
    }

    // Step 33: Create search_analytics collection
    const searchAnalyticsCollectionId = "search_analytics";
    let searchAnalyticsCollection;
    try {
      searchAnalyticsCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}`
      );
      console.log(`✓ Collection '${searchAnalyticsCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          searchAnalyticsCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: searchAnalyticsCollectionId,
              name: "Search Analytics",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${searchAnalyticsCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 34: Create search_analytics attributes
    const searchAnalyticsStringAttributes = [
      { key: "userId", size: 36, required: false }, // Optional - null for anonymous searches
      { key: "query", size: 200, required: true }, // Sanitized query
      { key: "timestamp", size: 50, required: true }, // ISO 8601 format
    ];

    const searchAnalyticsIntegerAttributes = [
      { key: "resultCount", required: true },
    ];

    const searchAnalyticsBooleanAttributes = [
      { key: "isNoResult", required: true },
    ];

    for (const attr of searchAnalyticsStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    for (const attr of searchAnalyticsIntegerAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}/attributes/integer`,
          {
            key: attr.key,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (integer)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    for (const attr of searchAnalyticsBooleanAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}/attributes/boolean`,
          {
            key: attr.key,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (boolean)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Note: createdAt is automatically handled by Appwrite, no need to create it

    // Step 35: Create search_analytics indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on search_analytics`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}/indexes`,
        {
          key: "idx_timestamp",
          type: "key",
          attributes: ["timestamp"],
          orders: ["DESC"],
        }
      );
      console.log(`  ✓ Created index 'idx_timestamp' on search_analytics`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_timestamp' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}/indexes`,
        {
          key: "idx_isNoResult",
          type: "key",
          attributes: ["isNoResult"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_isNoResult' on search_analytics`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_isNoResult' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 36: Set search_analytics permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${searchAnalyticsCollectionId}`,
        {
          name: "Search Analytics",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${searchAnalyticsCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // Step 37: Create carts collection
    const cartsCollectionId = "carts";
    let cartsCollection;
    try {
      cartsCollection = await appwriteRequest(
        "GET",
        `/databases/${databaseId}/collections/${cartsCollectionId}`
      );
      console.log(`✓ Collection '${cartsCollectionId}' already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        try {
          cartsCollection = await appwriteRequest(
            "POST",
            `/databases/${databaseId}/collections`,
            {
              collectionId: cartsCollectionId,
              name: "Shopping Carts",
              permissions: [
                Permission.read(Role.users()),
                Permission.write(Role.users()),
              ], // Collection-level allows querying; document-level restricts access
            }
          );
          console.log(`✓ Created collection '${cartsCollectionId}'`);
        } catch (createError: any) {
          console.error(`✗ Failed to create collection: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Step 38: Create carts attributes
    const cartsStringAttributes = [
      { key: "userId", size: 36, required: true },
      { key: "updatedAt", size: 50, required: true },
    ];

    for (const attr of cartsStringAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${cartsCollectionId}/attributes/string`,
          {
            key: attr.key,
            size: attr.size,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (string)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Cart items array (stored as JSON string in Appwrite)
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${cartsCollectionId}/attributes/string`,
        {
          key: "items",
          size: 10000, // Large size for JSON array
          required: false, // Changed to false to allow empty carts
        }
      );
      console.log(`  ✓ Created attribute 'items' (string)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'items' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'items': ${error.message}`);
      }
    }

    const cartsIntegerAttributes = [
      { key: "totalItems", required: true },
      { key: "totalPriceJmdCents", required: true },
    ];

    for (const attr of cartsIntegerAttributes) {
      try {
        await appwriteRequest(
          "POST",
          `/databases/${databaseId}/collections/${cartsCollectionId}/attributes/integer`,
          {
            key: attr.key,
            required: attr.required,
          }
        );
        console.log(`  ✓ Created attribute '${attr.key}' (integer)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`  - Attribute '${attr.key}' already exists`);
        } else {
          console.error(`  ✗ Failed to create attribute '${attr.key}': ${error.message}`);
        }
      }
    }

    // Store IDs array (stored as JSON string in Appwrite)
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${cartsCollectionId}/attributes/string`,
        {
          key: "storeIds",
          size: 1000, // Size for JSON array of store IDs
          required: false, // Changed to false to allow empty carts
        }
      );
      console.log(`  ✓ Created attribute 'storeIds' (string)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Attribute 'storeIds' already exists`);
      } else {
        console.error(`  ✗ Failed to create attribute 'storeIds': ${error.message}`);
      }
    }

    // Step 39: Create carts indexes
    try {
      await appwriteRequest(
        "POST",
        `/databases/${databaseId}/collections/${cartsCollectionId}/indexes`,
        {
          key: "idx_userId",
          type: "key",
          attributes: ["userId"],
          orders: ["ASC"],
        }
      );
      console.log(`  ✓ Created index 'idx_userId' on carts`);
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`  - Index 'idx_userId' already exists`);
      } else {
        console.error(`  ✗ Failed to create index: ${error.message}`);
      }
    }

    // Step 40: Set carts permissions
    try {
      await appwriteRequest(
        "PUT",
        `/databases/${databaseId}/collections/${cartsCollectionId}`,
        {
          name: "Shopping Carts",
          permissions: [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
          ], // Collection-level allows querying; document-level restricts access
        }
      );
      console.log(`  ✓ Updated permissions for '${cartsCollectionId}'`);
    } catch (error: any) {
      console.error(`  ✗ Failed to update permissions: ${error.message}`);
    }

    // These collections intentionally have no collection-level grants. The
    // Checkout Function must grant read(Role.user(userId)) on each document.
    await ensureOrderCollections();

    console.log("\n✅ Database setup completed successfully!");
    console.log(`\nDatabase ID: ${databaseId}`);
    console.log(`Collections: ${profilesCollectionId}, ${addressesCollectionId}, ${auditLogsCollectionId}, ${userPreferencesCollectionId}, ${notificationPreferencesCollectionId}, ${storeLocationProductCollectionId}, ${searchAnalyticsCollectionId}, ${cartsCollectionId}, orders, store_orders, order_items`);
    console.log("\nNote: Make sure to set APPWRITE_DATABASE_ID in your app configuration.");
  } catch (error: any) {
    console.error("\n❌ Database setup failed:", error.message);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();

