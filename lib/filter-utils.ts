import { SearchResult } from "./search-service";

export interface FilterState {
  brands: string[];
  categories: string[];
  partnerStores: string[];
  inStock: boolean | null;
  quickDelivery: boolean | null;
  priceRange: { min: number | null; max: number | null };
  dietaryRestrictions: {
    vegan: boolean;
    vegetarian: boolean;
    glutenFree: boolean;
  };
}

/**
 * Utility function to apply non-price filters to search results
 * 
 * Filters are applied in the following order:
 * 1. Brand filter (if any brands selected)
 * 2. Category filter (if any categories selected)
 * 3. Partner store filter (if any stores selected)
 * 4. In stock filter (if enabled)
 * 5. Quick delivery filter (if enabled) - placeholder implementation
 * 6. Dietary restrictions filter (if any selected) - placeholder implementation
 * 
 * Note: Quick delivery and dietary restrictions are placeholder implementations
 * that check product title/description for keywords. These should be replaced
 * with proper database fields when available.
 */

/**
 * Check if a product matches dietary restrictions based on title/description keywords
 * This is a placeholder implementation - should be replaced with proper database fields
 */
function matchesDietaryRestrictions(
  result: SearchResult,
  restrictions: FilterState["dietaryRestrictions"]
): boolean {
  // If no restrictions are selected, all products match
  if (!restrictions.vegan && !restrictions.vegetarian && !restrictions.glutenFree) {
    return true;
  }

  const title = result.product.title.toLowerCase();
  const description = (result.product.description || "").toLowerCase();
  const searchText = `${title} ${description}`;

  // Check vegan
  if (restrictions.vegan) {
    const veganKeywords = ["vegan", "plant-based", "dairy-free", "egg-free"];
    const hasVeganKeyword = veganKeywords.some((keyword) => searchText.includes(keyword));
    // Exclude non-vegan keywords
    const nonVeganKeywords = ["meat", "chicken", "beef", "pork", "fish", "dairy", "milk", "cheese", "egg", "honey"];
    const hasNonVeganKeyword = nonVeganKeywords.some((keyword) => searchText.includes(keyword));
    
    if (!hasVeganKeyword && hasNonVeganKeyword) {
      return false;
    }
    // If vegan keyword is present, it matches
    if (hasVeganKeyword) {
      return true;
    }
  }

  // Check vegetarian
  if (restrictions.vegetarian) {
    const vegetarianKeywords = ["vegetarian", "veggie", "plant-based"];
    const hasVegetarianKeyword = vegetarianKeywords.some((keyword) => searchText.includes(keyword));
    // Exclude non-vegetarian keywords
    const nonVegetarianKeywords = ["meat", "chicken", "beef", "pork", "fish", "seafood"];
    const hasNonVegetarianKeyword = nonVegetarianKeywords.some((keyword) => searchText.includes(keyword));
    
    if (!hasVegetarianKeyword && hasNonVegetarianKeyword) {
      return false;
    }
    // If vegetarian keyword is present, it matches
    if (hasVegetarianKeyword) {
      return true;
    }
  }

  // Check gluten-free
  if (restrictions.glutenFree) {
    const glutenFreeKeywords = ["gluten-free", "gluten free", "gf", "certified gluten-free"];
    const hasGlutenFreeKeyword = glutenFreeKeywords.some((keyword) => searchText.includes(keyword));
    // Exclude gluten-containing keywords
    const glutenKeywords = ["wheat", "barley", "rye", "flour", "bread", "pasta"];
    const hasGlutenKeyword = glutenKeywords.some((keyword) => searchText.includes(keyword));
    
    if (!hasGlutenFreeKeyword && hasGlutenKeyword) {
      return false;
    }
    // If gluten-free keyword is present, it matches
    if (hasGlutenFreeKeyword) {
      return true;
    }
  }

  // If we get here and restrictions are selected but no matches found,
  // only return true if no restrictions are actually selected
  return !restrictions.vegan && !restrictions.vegetarian && !restrictions.glutenFree;
}

/**
 * Check if a product has quick delivery
 * This is a placeholder implementation - should be replaced with proper database fields
 * For now, we assume all products have quick delivery if the store is active
 */
function hasQuickDelivery(result: SearchResult): boolean {
  // Placeholder: assume quick delivery if store is active
  // This should be replaced with proper database fields (e.g., delivery_time, delivery_available)
  return result.storeLocation.is_active;
}

/**
 * Apply filters to search results
 * 
 * @param results - Array of search results to filter
 * @param filters - Filter state to apply
 * @param userDeliveryAddress - Optional user delivery address for delivery-related filters
 * @returns Filtered array of search results
 */
export function applyFilters(
  results: SearchResult[],
  filters: FilterState,
  userDeliveryAddress?: { parish?: string; community?: string } | null
): SearchResult[] {
  if (!results || results.length === 0) {
    return [];
  }

  return results.filter((result) => {
    // Filter by brand
    if (filters.brands.length > 0) {
      const brandMatches = filters.brands.some(
        (filterBrand) => result.brand?.toLowerCase() === filterBrand.toLowerCase()
      );
      if (!brandMatches) {
        return false;
      }
    }

    // Filter by category
    if (filters.categories.length > 0) {
      const categoryMatches = filters.categories.some(
        (filterCategory) => result.category?.name?.toLowerCase() === filterCategory.toLowerCase()
      );
      if (!categoryMatches) {
        return false;
      }
    }

    // Filter by partner store
    if (filters.partnerStores.length > 0) {
      const storeName = result.storeLocation.display_name || result.storeLocation.name;
      const storeMatches = filters.partnerStores.some(
        (filterStore) => storeName?.toLowerCase() === filterStore.toLowerCase()
      );
      if (!storeMatches) {
        return false;
      }
    }

    // Filter by in stock
    if (filters.inStock === true) {
      if (!result.inStock) {
        return false;
      }
    }

    // Filter by quick delivery
    if (filters.quickDelivery === true) {
      // Check if store supports quick delivery to user's address
      // For now, we check if the store is active and optionally matches user's parish
      if (!hasQuickDelivery(result)) {
        return false;
      }
      
      // If user has a delivery address, optionally filter by location
      // This is a placeholder - proper implementation would check delivery zones
      if (userDeliveryAddress?.parish && result.storeLocation.parish) {
        // For now, we allow all stores regardless of parish
        // This can be enhanced to check delivery zones when available
      }
    }

    // Filter by price range
    if (filters.priceRange.min !== null || filters.priceRange.max !== null) {
      const productPrice = result.priceJmdCents;
      
      // Check minimum price
      if (filters.priceRange.min !== null && productPrice < filters.priceRange.min) {
        return false;
      }
      
      // Check maximum price
      if (filters.priceRange.max !== null && productPrice > filters.priceRange.max) {
        return false;
      }
    }

    // Filter by dietary restrictions
    if (
      filters.dietaryRestrictions.vegan ||
      filters.dietaryRestrictions.vegetarian ||
      filters.dietaryRestrictions.glutenFree
    ) {
      if (!matchesDietaryRestrictions(result, filters.dietaryRestrictions)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.brands.length > 0 ||
    filters.categories.length > 0 ||
    filters.partnerStores.length > 0 ||
    filters.inStock !== null ||
    filters.quickDelivery !== null ||
    filters.priceRange.min !== null ||
    filters.priceRange.max !== null ||
    filters.dietaryRestrictions.vegan ||
    filters.dietaryRestrictions.vegetarian ||
    filters.dietaryRestrictions.glutenFree
  );
}
