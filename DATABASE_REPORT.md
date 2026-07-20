# Database Inspection Report

**Generated:** 2026-07-20T19:17:33.504Z  
**Database ID:** grovi_staging

---

🔍 Inspecting Appwrite Database...

Database ID: grovi_staging

📊 Comparing with previous report from 1/21/2026, 12:25:14 PM

📦 Fetching collections...
✓ Found 18 collection(s) (664ms)


============================================================
Collection: Categories (categories)
============================================================
Document security: disabled
Collection permissions: read("users"), read("guests")

📋 Attributes (6) [244ms]:
  - path_names: string[array] (optional)
  - depth: integer (optional)
  - name: string (required)
  - parent_id: string (optional)
  - path_ids: string[array] (optional)
  - slug: string (required)

🔍 Indexes (3) [345ms]:
  - slug: key on [slug]
  - parent_id: key on [parent_id]
  - idx_name_fulltext: fulltext on [name]

📄 Documents: 22 [526ms]

✓ Data Quality: Good (checked 10 documents)

📝 Sample document structure:
  - depth: number = 0
  - path_names: array = [1 items]
  - name: string = Groceries
  - parent_id: object = null
  - path_ids: array = [1 items]
  - slug: string = groceries
  - $id: string = cat_groceries
  - $sequence: number = 1
  - $createdAt: string = 2026-01-03T01:49:12.040+00:00
  - $updatedAt: string = 2026-01-03T01:49:12.040+00:00
  - $permissions: array = [0 items]
  - $databaseId: string = grovi_staging
  - $collectionId: string = categories

============================================================
Collection: Products (products)
============================================================
Document security: disabled
Collection permissions: read("any"), create("any"), update("any"), delete("any")

📋 Attributes (16) [243ms]:
  - variants: string (optional)
  - updated_at: string (required)
  - category_path_ids: string[array] (required)
  - brand: string (optional)
  - description: string (optional)
  - unit_size: string (optional)
  - category_leaf_id: string (required)
  - primary_image_file_id: string (required)
  - title: string (required)
  - package_quantity: integer (optional)
  - category_path: string[array] (optional)
  - primary_image_url: string (required)
  - sku: string (required)
  - images: string (required)
  - net_weight: string (optional)
  - country_of_origin: string (optional)

🔍 Indexes (9) [242ms]:
  - external_source_external_id: key on [external_id]
  - category_leaf_id: key on [category_leaf_id]
  - sku: key on [sku]
  - primary_image_file_id: key on [primary_image_file_id]
  - idx_title_fulltext: fulltext on [title]
  - idx_brand_search: key on [brand]
  - idx_category_leaf_id_search: key on [category_leaf_id]
  - idx_external_source_in_stock: key on [external_source]
  - idx_sku_unique_search: unique on [sku]

📄 Documents: 1050 [305ms]

✓ Data Quality: Good (checked 10 documents)

📝 Sample document structure:
  - variants: string = [{"name":"flavor","value":"Variety Pack"}]
  - category_path_ids: array = [2 items]
  - updated_at: string = 2026-01-12T05:20:22.868Z
  - brand: string = Kiss
  - description: string = The KISS Family Savers assorted pack, 16 units, of...
  - unit_size: object = null
  - category_leaf_id: string = cat_cookies-desserts-and-ice-cream
  - primary_image_file_id: string = 6958758cedf5151f9a47
  - title: string = Kiss Assorted Cream-Filled Cupcake
  - category_path: array = [2 items]
  - package_quantity: number = 16
  - primary_image_url: string = https://nyc.cloud.appwrite.io/v1/storage/buckets/p...
  - sku: string = GV-0fBk0BtCAfns
  - images: string = [{"fileId":"6958758cedf5151f9a47","url":"https://n...
  - net_weight: object = null
  - country_of_origin: object = null
  - $id: string = 6958759a0030e6ef187a
  - $sequence: number = 1
  - $createdAt: string = 2026-01-03T01:49:14.666+00:00
  - $updatedAt: string = 2026-01-12T05:20:31.328+00:00
  - $permissions: array = [0 items]
  - $databaseId: string = grovi_staging
  - $collectionId: string = products

============================================================
Collection: Image Sources (image_sources)
============================================================
Document security: disabled
Collection permissions: read("any"), create("any"), update("any"), delete("any")

📋 Attributes (4) [249ms]:
  - source_url: string (required)
  - fileId: string (required)
  - stored_image_url: string (required)
  - source_url_hash: string (required)

🔍 Indexes (2) [329ms]:
  - source_url_hash: key on [source_url_hash]
  - file_id_lookup: key on [fileId]

📄 Documents: 4909 [394ms]

✓ Data Quality: Good (checked 10 documents)

📝 Sample document structure:
  - source_url: string = https://d31f1ehqijlcua.cloudfront.net/n/a/a/b/6/aa...
  - fileId: string = 6958758c768d9626525a
  - stored_image_url: string = https://nyc.cloud.appwrite.io/v1/storage/buckets/p...
  - source_url_hash: string = 079585a93d02ff7100431279013f5c7bffc4500e3fc1f5cdc9...
  - $id: string = 6958758d8812fda88f14
  - $sequence: number = 1
  - $createdAt: string = 2026-01-03T01:49:01.558+00:00
  - $updatedAt: string = 2026-01-12T03:34:39.586+00:00
  - $permissions: array = [0 items]
  - $databaseId: string = grovi_staging
  - $collectionId: string = image_sources

============================================================
Collection: SKU Registry (sku_registry)
============================================================
Document security: disabled
Collection permissions: read("any"), create("any"), update("any"), delete("any")

📋 Attributes (6) [259ms]:
  - brand: string (optional)
  - title: string (required)
  - sku: string (required)
  - manufacturer_id: string (optional)
  - unit_size: string (optional)
  - identity_key: string (required)

🔍 Indexes (2) [347ms]:
  - identity_key: key on [identity_key]
  - sku_lookup: key on [sku]

📄 Documents: 1066 [307ms]

✓ Data Quality: Good (checked 10 documents)

📝 Sample document structure:
  - brand: string = member's selection
  - title: string = member's selection iced coffee mocha drink
  - sku: string = GV-0kpUwAokmHgp
  - unit_size: string = 296 ml
  - manufacturer_id: object = null
  - identity_key: string = brand:member's selection|title:member's selection ...
  - $id: string = 69587596003c5eb8526d
  - $sequence: number = 1
  - $createdAt: string = 2026-01-03T01:49:10.751+00:00
  - $updatedAt: string = 2026-01-03T01:49:10.751+00:00
  - $permissions: array = [0 items]
  - $databaseId: string = grovi_staging
  - $collectionId: string = sku_registry

============================================================
Collection: Profiles (profiles)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (6) [357ms]:
  - userId: string (required)
  - name: string (optional)
  - phone: string (required)
  - email: string (required)
  - firstName: string (optional)
  - lastName: string (optional)

🔍 Indexes (1) [239ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Audit Logs (audit_logs)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (4) [380ms]:
  - userId: string (required)
  - eventType: string (required)
  - metadata: string (optional)
  - timestamp: string (required)

🔍 Indexes (3) [227ms]:
  - idx_userId: key on [userId]
  - idx_eventType: key on [eventType]
  - idx_timestamp: key on [timestamp]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Addresses (addresses)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (9) [256ms]:
  - userId: string (required)
  - label: string (required)
  - parish: string (required)
  - community: string (required)
  - street: string (optional)
  - houseDetails: string (optional)
  - landmarkDirections: string (required)
  - contactPhone: string (optional)
  - default: boolean (required)

🔍 Indexes (1) [238ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: User Preferences (user_preferences)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (3) [261ms]:
  - userId: string (required)
  - dietaryPreferences: string[array] (optional)
  - categoryPreferences: string[array] (optional)

🔍 Indexes (1) [341ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Notification Preferences (notification_preferences)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (7) [264ms]:
  - userId: string (required)
  - pushToken: string (optional)
  - orderUpdatesEnabled: boolean (required)
  - promotionsEnabled: boolean (required)
  - pushEnabled: boolean (required)
  - emailEnabled: boolean (required)
  - smsEnabled: boolean (required)

🔍 Indexes (1) [240ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Payment Methods (payment_methods)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (6) [358ms]:
  - userId: string (required)
  - type: string (required)
  - brand: string (optional)
  - last4: string (optional)
  - maskedNumber: string (optional)
  - label: string (optional)

🔍 Indexes (1) [341ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Store Brands (store_brand)
============================================================
Document security: disabled
Collection permissions: create("users"), read("users"), update("users"), delete("users")

📋 Attributes (7) [247ms]:
  - name: string (required)
  - slug: string (optional)
  - website_url: string (optional)
  - logo_url: string (optional)
  - currency: string (optional)
  - country_code: string (required)
  - is_active: boolean (required)

🔍 Indexes (1) [241ms]:
  - idx_brand_slug_unique: key on [slug]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Store Locations (store_location)
============================================================
Document security: disabled
Collection permissions: create("users"), read("users"), update("users"), delete("users")

📋 Attributes (10) [351ms]:
  - brand_id: string (required)
  - name: string (required)
  - display_name: string (required)
  - slug: string (required)
  - parish: string (optional)
  - address_line1: string (optional)
  - address_line2: string (optional)
  - phone: string (optional)
  - is_active: boolean (required)
  - priority: integer (optional)

🔍 Indexes (1) [245ms]:
  - idx_is_active: key on [is_active]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Store Location Product (store_location_product)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (14) [259ms]:
  - product_id: string (required)
  - store_location_id: string (required)
  - brand_id: string (required)
  - source_key: string (optional)
  - external_id: string (optional)
  - external_url: string (optional)
  - price_currency: string (optional)
  - category_leaf_id: string (optional)
  - category_path_ids: string[array] (optional)
  - price_jmd_cents: integer (required)
  - in_stock: boolean (required)
  - first_seen_at: datetime (optional)
  - last_seen_at: datetime (optional)
  - content_hash: string (optional)

🔍 Indexes (7) [236ms]:
  - idx_product_location: key on [product_id, store_location_id]
  - idx_store_location: key on [store_location_id]
  - idx_brand: key on [brand_id]
  - idx_in_stock: key on [in_stock]
  - idx_store_stock: key on [store_location_id, in_stock]
  - idx_category_leaf: key on [category_leaf_id]
  - idx_price: key on [price_jmd_cents]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Search Analytics (search_analytics)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (5) [360ms]:
  - userId: string (optional)
  - query: string (required)
  - timestamp: string (required)
  - resultCount: integer (required)
  - isNoResult: boolean (required)

🔍 Indexes (3) [240ms]:
  - idx_userId: key on [userId]
  - idx_timestamp: key on [timestamp]
  - idx_isNoResult: key on [isNoResult]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Shopping Carts (carts)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (6) [253ms]:
  - userId: string (required)
  - updatedAt: string (required)
  - totalItems: integer (required)
  - totalPriceJmdCents: integer (required)
  - items: string (optional)
  - storeIds: string (optional)

🔍 Indexes (1) [336ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Orders (orders)
============================================================
Document security: enabled
Collection permissions: (none)

📋 Attributes (25) [246ms]:
  - userId: string (required)
  - orderNumber: string (required)
  - idempotencyKey: string (required)
  - requestFingerprint: string (required)
  - status: string (required)
  - statusReason: string (optional)
  - paymentMethod: string (required)
  - paymentStatus: string (required)
  - currency: string (required)
  - addressId: string (required)
  - addressLabel: string (required)
  - deliveryParish: string (required)
  - deliveryCommunity: string (required)
  - deliveryStreet: string (optional)
  - deliveryHouseDetails: string (optional)
  - deliveryLandmarkDirections: string (required)
  - deliveryContactPhone: string (required)
  - itemCount: integer (required)
  - storeCount: integer (required)
  - subtotalJmdCents: integer (required)
  - deliveryFeeJmdCents: integer (required)
  - discountJmdCents: integer (required)
  - totalJmdCents: integer (required)
  - schemaVersion: integer (required)
  - cartUpdatedAt: datetime (optional)

🔍 Indexes (5) [248ms]:
  - idx_idempotencyKey: unique on [idempotencyKey]
  - idx_orderNumber: unique on [orderNumber]
  - idx_userId: key on [userId]
  - idx_user_placed: key on [userId, placedAt]
  - idx_status: key on [status]

📄 Documents: 0 [349ms]

============================================================
Collection: Store Orders (store_orders)
============================================================
Document security: enabled
Collection permissions: (none)

📋 Attributes (16) [581ms]:
  - orderId: string (required)
  - userId: string (required)
  - storeLocationId: string (required)
  - storeName: string (required)
  - storeBrandId: string (optional)
  - status: string (required)
  - statusReason: string (optional)
  - itemCount: integer (required)
  - subtotalJmdCents: integer (required)
  - deliveryFeeJmdCents: integer (required)
  - discountJmdCents: integer (required)
  - totalJmdCents: integer (required)
  - acceptedAt: datetime (optional)
  - dispatchedAt: datetime (optional)
  - deliveredAt: datetime (optional)
  - cancelledAt: datetime (optional)

🔍 Indexes (3) [237ms]:
  - idx_orderId: key on [orderId]
  - idx_storeLocationId: key on [storeLocationId]
  - idx_store_status: key on [storeLocationId, status]

📄 Documents: 0 [685ms]

============================================================
Collection: Order Items (order_items)
============================================================
Document security: enabled
Collection permissions: (none)

📋 Attributes (13) [372ms]:
  - orderId: string (required)
  - storeOrderId: string (required)
  - userId: string (required)
  - productId: string (required)
  - storeLocationId: string (required)
  - sku: string (required)
  - title: string (required)
  - brand: string (optional)
  - imageUrl: string (optional)
  - unitSize: string (optional)
  - quantity: integer (required)
  - unitPriceJmdCents: integer (required)
  - lineTotalJmdCents: integer (required)

🔍 Indexes (3) [248ms]:
  - idx_orderId: key on [orderId]
  - idx_storeOrderId: key on [storeOrderId]
  - idx_productId: key on [productId]

📄 Documents: 0 [273ms]


============================================================
🔎 SEARCH REQUIREMENTS CHECK
============================================================

✓ products: EXISTS
  - Attributes: 16
  - Indexes: 9
  - Documents: 1050
  - Has 'name' attribute: ✗
  - Has 'sku' attribute: ✓
  - Has full-text index on 'name': ✗ (recommended)

✗ brands: MISSING

✓ categories: EXISTS
  - Attributes: 6
  - Indexes: 3
  - Documents: 22
  - Has 'name' attribute: ✓
  - Has full-text index on 'name': ✓

✗ store_locations: MISSING

✓ store_location_product: EXISTS
  - Attributes: 14
  - Indexes: 7
  - Documents: 0
  - Has 'product_id' attribute: ✓
  - Has 'store_location_id' attribute: ✓
  - Has 'brand_id' attribute: ✓
  - Has 'in_stock' attribute: ✓
  - Has 'price_jmd_cents' attribute: ✓
  - Has 'idx_in_stock' index: ✓
  - Has 'idx_store_stock' index: ✓
  - Has 'idx_brand' index: ✓
  - Has 'idx_category_leaf' index: ✓

✓ orders: EXISTS
  - Attributes: 25
  - Indexes: 5
  - Documents: 0
  - Document security enabled: ✓
  - No collection-level permissions: ✓
  - Required attributes available: ✗ missing placedAt
  - Required indexes available: ✓

✓ store_orders: EXISTS
  - Attributes: 16
  - Indexes: 3
  - Documents: 0
  - Document security enabled: ✓
  - No collection-level permissions: ✓
  - Required attributes available: ✓
  - Required indexes available: ✓

✓ order_items: EXISTS
  - Attributes: 13
  - Indexes: 3
  - Documents: 0
  - Document security enabled: ✓
  - No collection-level permissions: ✓
  - Required attributes available: ✓
  - Required indexes available: ✓


============================================================
💡 RECOMMENDATIONS
============================================================

Missing collections that need to be created:
  - brands
  - store_locations

⚠️  products: Consider adding full-text index on 'name' for better search performance


============================================================
🔗 RELATIONSHIP INTEGRITY CHECK
============================================================

⚠️  Cannot validate relationships: insufficient data

Checking products -> categories relationships...
✓ All product category references valid


============================================================
⚡ PERFORMANCE SUMMARY
============================================================

Total inspection time: 20321ms (20.32s)
Total API request time: 13299ms
Average per collection: 739ms

⚠️  Slow collections (>1000ms):
  - Store Orders: 1503ms
  - Categories: 1115ms


============================================================
📈 CHANGES SINCE LAST INSPECTION
============================================================

✨ New collections (4):
  + Shopping Carts (carts)
  + Orders (orders)
  + Store Orders (store_orders)
  + Order Items (order_items)

📊 Collection changes:
  Products: +1 attrs
  Store Location Product: -1050 docs


✅ Inspection complete!


---

*Report auto-generated by `scripts/inspect-database.ts`*
