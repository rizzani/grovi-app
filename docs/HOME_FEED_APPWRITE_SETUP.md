# Home feed Appwrite setup

The mobile client does not create schema. Add these optional attributes to `products`; defaults allow older documents to be read safely.

| Attribute | Type | Suggested default |
|---|---|---|
| `isActive` | boolean | `true` for existing valid catalog products |
| `isFeatured` | boolean | `false` |
| `featuredPriority` | integer | `0` |
| `featuredStartAt`, `featuredEndAt` | datetime | null |
| `isEssential` | boolean | `false` |
| `manualPopularityScore` | float | `0` |
| `viewCount`, `cartAddCount`, `orderCount` | integer | `0` |
| `salePrice` | integer (JMD cents) | null |
| `promotionStartAt`, `promotionEndAt` | datetime | null |

If sale price varies by store, prefer optional integer `sale_price_jmd_cents` on `store_location_product` and leave product `salePrice` as a catalog-wide fallback. Stock and regular price already use `in_stock` and `price_jmd_cents` on that collection.

Recommended indexes after attributes are available:

- `products`: keys on `isActive`, `isFeatured`, `isEssential`, and `$createdAt`; composites on `[isActive,isFeatured,featuredPriority]` and `[isActive,isEssential]`.
- `store_location_product`: existing `[store_location_id,in_stock]`, `in_stock`, `product_id`, and price indexes are sufficient; add `sale_price_jmd_cents` only if server-side deal queries are introduced.
- `store_location`: keep `is_active`; add composite `[parish,is_active]` for delivery-area feeds.

Appwrite cannot calculate weighted popularity in a query. The client retrieves a bounded eligible candidate set and scores it locally. Once the fields and indexes above are deployed, `home-feed-service.ts` can add server-side curation predicates to reduce candidates further. Engagement counters should be updated by trusted backend functions, not directly by the mobile client.
