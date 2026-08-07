# Grovi MVP analytics

Grovi records lightweight events in the Appwrite `analytics_events` collection. The mobile client can create records anonymously or while signed in; it cannot read, update, or delete them. Event-specific values are stored in `propertiesJson` so the collection schema remains small.

## Setup

Run `npm run setup-database` with the existing `EXPO_PUBLIC_APPWRITE_ENDPOINT`, `EXPO_PUBLIC_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, and `APPWRITE_DATABASE_ID` values. No new environment variables are required. The script creates the collection, attributes, indexes, and client permissions.

The collection has `eventName`, optional `userId`, `sessionId`, `propertiesJson`, `platform`, `appVersion`, and `createdAt`. Indexes cover `eventName`, `userId`, `createdAt`, and `(eventName, createdAt)`. Collection-level access grants only `Permission.create(Role.any())` so app-open and other anonymous events must work. Client-created documents receive no document permissions, so clients cannot read, update, or delete them. Restrict reporting to an Appwrite admin/server context.

Supported event names are: `app_opened`, `user_signed_up`, `user_logged_in`, `location_selected`, `product_searched`, `product_viewed`, `product_added_to_cart`, `product_removed_from_cart`, `checkout_started`, `checkout_abandoned`, `order_placed`, and `order_cancelled` (reserved until order cancellation is exposed in the app).

## Local testing and limitations

Use `npm run test:analytics` for payload/property/metric helper tests. In Expo, verify events through the Appwrite Console or an admin-side paginated query. `lib/analytics-query-service.ts` deliberately limits each page to 100 documents; its summary helpers are suitable for MVP-sized exports, not production-scale aggregation. The client does not query analytics data.

The session ID is an anonymous Appwrite-generated ID stored in AsyncStorage and renewed after 30 days. No passwords, tokens, payment details, exact coordinates, or full delivery addresses are sent. Delivery analytics uses the parish/service area only.
