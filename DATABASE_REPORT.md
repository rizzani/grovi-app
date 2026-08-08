# Database Inspection Report

**Generated:** 2026-08-08T14:32:43.215Z  
**Database ID:** grovi_staging

---

🔍 Inspecting Appwrite Database...

Database ID: grovi_staging

📊 Comparing with previous report from 7/20/2026, 2:17:33 PM

📦 Fetching collections...
✓ Found 19 collection(s) (1575ms)


============================================================
Collection: Categories (categories)
============================================================
Document security: disabled
Collection permissions: read("users"), read("guests")

📋 Attributes (6) [198ms]:
  - path_names: string[array] (optional)
  - depth: integer (optional)
  - name: string (required)
  - parent_id: string (optional)
  - path_ids: string[array] (optional)
  - slug: string (required)

🔍 Indexes (3) [197ms]:
  - slug: key on [slug]
  - parent_id: key on [parent_id]
  - idx_name_fulltext: fulltext on [name]

📄 Documents: 22 [439ms]

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

📋 Attributes (25) [195ms]:
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
  - isActive: boolean (optional)
  - isFeatured: boolean (optional)
  - featuredPriority: integer (optional)
  - featuredStartAt: datetime (optional)
  - featuredEndAt: datetime (optional)
  - isEssential: boolean (optional)
  - manualPopularityScore: double (optional)
  - viewCount: integer (optional)
  - cartAddCount: integer (optional)

🔍 Indexes (9) [191ms]:
  - external_source_external_id: key on [external_id]
  - category_leaf_id: key on [category_leaf_id]
  - sku: key on [sku]
  - primary_image_file_id: key on [primary_image_file_id]
  - idx_title_fulltext: fulltext on [title]
  - idx_brand_search: key on [brand]
  - idx_category_leaf_id_search: key on [category_leaf_id]
  - idx_external_source_in_stock: key on [external_source]
  - idx_sku_unique_search: unique on [sku]

📄 Documents: 1050 [224ms]

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
  - isActive: object = null
  - isFeatured: object = null
  - featuredPriority: object = null
  - featuredStartAt: object = null
  - featuredEndAt: object = null
  - isEssential: object = null
  - manualPopularityScore: object = null
  - viewCount: object = null
  - cartAddCount: object = null
  - orderCount: object = null
  - salePrice: object = null
  - promotionStartAt: object = null
  - promotionEndAt: object = null
  - rating: object = null
  - review_count: object = null
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

📋 Attributes (4) [210ms]:
  - source_url: string (required)
  - fileId: string (required)
  - stored_image_url: string (required)
  - source_url_hash: string (required)

🔍 Indexes (2) [192ms]:
  - source_url_hash: key on [source_url_hash]
  - file_id_lookup: key on [fileId]

📄 Documents: 4909 [216ms]

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

📋 Attributes (6) [209ms]:
  - brand: string (optional)
  - title: string (required)
  - sku: string (required)
  - manufacturer_id: string (optional)
  - unit_size: string (optional)
  - identity_key: string (required)

🔍 Indexes (2) [179ms]:
  - identity_key: key on [identity_key]
  - sku_lookup: key on [sku]

📄 Documents: 1066 [872ms]

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

📋 Attributes (6) [189ms]:
  - userId: string (required)
  - name: string (optional)
  - phone: string (required)
  - email: string (required)
  - firstName: string (optional)
  - lastName: string (optional)

🔍 Indexes (1) [191ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Audit Logs (audit_logs)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (4) [193ms]:
  - userId: string (required)
  - eventType: string (required)
  - metadata: string (optional)
  - timestamp: string (required)

🔍 Indexes (3) [88ms]:
  - idx_userId: key on [userId]
  - idx_eventType: key on [eventType]
  - idx_timestamp: key on [timestamp]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Addresses (addresses)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (14) [196ms]:
  - userId: string (required)
  - label: string (required)
  - parish: string (required)
  - community: string (required)
  - street: string (optional)
  - houseDetails: string (optional)
  - landmarkDirections: string (optional)
  - contactPhone: string (optional)
  - default: boolean (required)
  - deliveryAddress: string (optional)
  - formattedAddress: string (optional)
  - locationUpdatedAt: string (optional)
  - latitude: double (optional)
  - longitude: double (optional)

🔍 Indexes (2) [186ms]:
  - idx_userId: key on [userId]
  - idx_user_default: key on [userId, default]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: User Preferences (user_preferences)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (3) [197ms]:
  - userId: string (required)
  - dietaryPreferences: string[array] (optional)
  - categoryPreferences: string[array] (optional)

🔍 Indexes (1) [188ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Notification Preferences (notification_preferences)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (7) [197ms]:
  - userId: string (required)
  - pushToken: string (optional)
  - orderUpdatesEnabled: boolean (required)
  - promotionsEnabled: boolean (required)
  - pushEnabled: boolean (required)
  - emailEnabled: boolean (required)
  - smsEnabled: boolean (required)

🔍 Indexes (1) [185ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Payment Methods (payment_methods)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (6) [203ms]:
  - userId: string (required)
  - type: string (required)
  - brand: string (optional)
  - last4: string (optional)
  - maskedNumber: string (optional)
  - label: string (optional)

🔍 Indexes (1) [183ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Store Brands (store_brand)
============================================================
Document security: disabled
Collection permissions: create("users"), read("users"), update("users"), delete("users")

📋 Attributes (7) [195ms]:
  - name: string (required)
  - slug: string (optional)
  - website_url: string (optional)
  - logo_url: string (optional)
  - currency: string (optional)
  - country_code: string (required)
  - is_active: boolean (required)

🔍 Indexes (1) [73ms]:
  - idx_brand_slug_unique: key on [slug]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Store Locations (store_location)
============================================================
Document security: disabled
Collection permissions: create("users"), read("users"), update("users"), delete("users")

📋 Attributes (14) [456ms]:
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
  - delivery_time_minutes: integer (optional)
  - latitude: double (optional)
  - longitude: double (optional)
  - logo_url: string (optional)

🔍 Indexes (2) [80ms]:
  - idx_is_active: key on [is_active]
  - idx_parish_active: key on [parish, is_active]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Store Location Product (store_location_product)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (15) [194ms]:
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
  - sale_price_jmd_cents: integer (optional)

🔍 Indexes (7) [191ms]:
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

📋 Attributes (5) [269ms]:
  - userId: string (optional)
  - query: string (required)
  - timestamp: string (required)
  - resultCount: integer (required)
  - isNoResult: boolean (required)

🔍 Indexes (3) [187ms]:
  - idx_userId: key on [userId]
  - idx_timestamp: key on [timestamp]
  - idx_isNoResult: key on [isNoResult]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Shopping Carts (carts)
============================================================
Document security: disabled
Collection permissions: read("users"), create("users"), update("users"), delete("users")

📋 Attributes (6) [100ms]:
  - userId: string (required)
  - updatedAt: string (required)
  - totalItems: integer (required)
  - totalPriceJmdCents: integer (required)
  - items: string (optional)
  - storeIds: string (optional)

🔍 Indexes (1) [187ms]:
  - idx_userId: key on [userId]

📄 Documents: Unable to fetch (The current user is not authorized to perform the requested action.)

============================================================
Collection: Orders (orders)
============================================================
Document security: enabled
Collection permissions: (none)

📋 Attributes (25) [194ms]:
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
  - deliveryContactPhone: string (optional)
  - itemCount: integer (required)
  - storeCount: integer (required)
  - subtotalJmdCents: integer (required)
  - deliveryFeeJmdCents: integer (required)
  - discountJmdCents: integer (required)
  - totalJmdCents: integer (required)
  - schemaVersion: integer (required)
  - cartUpdatedAt: datetime (optional)

🔍 Indexes (6) [78ms]:
  - idx_idempotencyKey: unique on [idempotencyKey]
  - idx_orderNumber: unique on [orderNumber]
  - idx_userId: key on [userId]
  - idx_user_placed: key on [userId, placedAt]
  - idx_status: key on [status]
  - idx_user_cart_revision: key on [userId, cartUpdatedAt, status]

📄 Documents: 0 [224ms]

============================================================
Collection: Store Orders (store_orders)
============================================================
Document security: enabled
Collection permissions: (none)

📋 Attributes (16) [195ms]:
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

🔍 Indexes (3) [77ms]:
  - idx_orderId: key on [orderId]
  - idx_storeLocationId: key on [storeLocationId]
  - idx_store_status: key on [storeLocationId, status]

📄 Documents: 0 [90ms]

============================================================
Collection: Order Items (order_items)
============================================================
Document security: enabled
Collection permissions: (none)

📋 Attributes (13) [200ms]:
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

🔍 Indexes (3) [195ms]:
  - idx_orderId: key on [orderId]
  - idx_storeOrderId: key on [storeOrderId]
  - idx_productId: key on [productId]

📄 Documents: 0 [145ms]

============================================================
Collection: Analytics Events (analytics_events)
============================================================
Document security: enabled
Collection permissions: create("any")

📋 Attributes (7) [84ms]:
  - eventName: string (required)
  - userId: string (optional)
  - sessionId: string (required)
  - propertiesJson: string (required)
  - platform: string (required)
  - appVersion: string (required)
  - createdAt: string (required)

🔍 Indexes (4) [80ms]:
  - idx_eventName: key on [eventName]
  - idx_userId: key on [userId]
  - idx_createdAt: key on [createdAt]
  - idx_event_created: key on [eventName, createdAt]

📄 Documents: 0 [103ms]


============================================================
🔎 SEARCH REQUIREMENTS CHECK
============================================================

✓ products: EXISTS
  - Attributes: 25
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
  - Attributes: 15
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
  - Indexes: 6
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

Total inspection time: 13793ms (13.79s)
Total API request time: 9115ms
Average per collection: 480ms

⚠️  Slow collections (>1000ms):
  - SKU Registry: 1260ms


============================================================
📈 CHANGES SINCE LAST INSPECTION
============================================================

✨ New collections (1):
  + Analytics Events (analytics_events)

📊 Collection changes:
  Products: +9 attrs
  Addresses: +5 attrs +1 indexes
  Store Locations: +4 attrs +1 indexes
  Store Location Product: +1 attrs
  Orders: +1 indexes


✅ Inspection complete!


---

*Report auto-generated by `scripts/inspect-database.ts`*
