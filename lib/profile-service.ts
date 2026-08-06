import { databases, databaseId } from "./appwrite-client";
import { ID, Query, Permission, Role } from "appwrite";
import {
  logAddressCreated,
  logAddressUpdated,
  logAddressDeleted,
  logAddressDefaultChanged,
} from "./audit-service";

const PROFILES_COLLECTION_ID = "profiles";
const ADDRESSES_COLLECTION_ID = "addresses";

export interface Profile {
  $id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  name?: string; // Kept for backward compatibility during migration
  phone: string;
  email: string;
  createdAt: string;
}

export interface Address {
  $id: string;
  userId: string;
  label: string;
  parish: string;
  community: string;
  street?: string;
  houseDetails?: string;
  landmarkDirections?: string;
  contactPhone?: string;
  default: boolean;
  deliveryAddress?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  locationUpdatedAt?: string;
  createdAt: string;
}

export interface CreateProfileParams {
  userId: string;
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  name?: string; // Kept for backward compatibility during migration
}

export interface CreateAddressParams {
  userId: string;
  label: string;
  parish: string;
  community: string;
  street?: string;
  houseDetails?: string;
  landmarkDirections?: string;
  contactPhone?: string;
  isDefault: boolean;
  deliveryAddress?: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  locationUpdatedAt?: string;
}

export interface UpdateAddressParams {
  addressId: string;
  label?: string;
  parish?: string;
  community?: string;
  street?: string;
  houseDetails?: string;
  landmarkDirections?: string;
  contactPhone?: string;
  isDefault?: boolean;
  deliveryAddress?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  locationUpdatedAt?: string;
}

/**
 * Splits a full name into firstName and lastName
 * Handles various name formats (single name, two names, multiple names)
 */
function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
  if (!fullName || !fullName.trim()) {
    return {};
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 0) {
    return {};
  } else if (parts.length === 1) {
    // Single name - use as firstName
    return { firstName: parts[0] };
  } else {
    // Multiple names - first is firstName, rest combined as lastName
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }
}

export async function createOrUpdateProfile(
  params: CreateProfileParams
): Promise<Profile> {
  try {
    const { userId, email, phone, firstName, lastName, name } = params;

    // Determine firstName and lastName
    // Priority: explicit firstName/lastName > split from name > existing profile values
    let finalFirstName = firstName;
    let finalLastName = lastName;

    // If name is provided but firstName/lastName are not, split the name
    if ((!finalFirstName && !finalLastName) && name) {
      const split = splitName(name);
      finalFirstName = split.firstName;
      finalLastName = split.lastName;
    }

    // Check if profile already exists
    try {
      const existingProfiles = await databases.listDocuments(
        databaseId,
        PROFILES_COLLECTION_ID,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      if (existingProfiles.documents.length > 0) {
        // Update existing profile
        const existingProfile = existingProfiles.documents[0] as Profile;
        
        // If we don't have firstName/lastName, try to get from existing profile or split existing name
        if (!finalFirstName && !finalLastName) {
          if (existingProfile.firstName || existingProfile.lastName) {
            finalFirstName = finalFirstName || existingProfile.firstName;
            finalLastName = finalLastName || existingProfile.lastName;
          } else if (existingProfile.name) {
            const split = splitName(existingProfile.name);
            finalFirstName = split.firstName;
            finalLastName = split.lastName;
          }
        }

        const updateData: any = {
          email,
          phone,
        };

        // Update firstName and lastName
        if (finalFirstName !== undefined) {
          updateData.firstName = finalFirstName || null;
        }
        if (finalLastName !== undefined) {
          updateData.lastName = finalLastName || null;
        }

        // Keep name for backward compatibility (generate from firstName + lastName if needed)
        if (finalFirstName || finalLastName) {
          const fullName = [finalFirstName, finalLastName].filter(Boolean).join(" ").trim() || null;
          updateData.name = fullName;
        } else if (name !== undefined) {
          updateData.name = name || null;
        }

        const updatedProfile = await databases.updateDocument(
          databaseId,
          PROFILES_COLLECTION_ID,
          existingProfile.$id,
          updateData
        );
        return updatedProfile as Profile;
      }
    } catch (error: any) {
      // If query fails, continue to create new profile
      if (error.code !== 404) {
        throw error;
      }
    }

    // Create new profile with document-level permissions
    // Note: createdAt is automatically set by Appwrite
    // Permissions ensure only the user can read/write their own profile
    const fullName = [finalFirstName, finalLastName].filter(Boolean).join(" ").trim() || null;
    
    const newProfile = await databases.createDocument(
      databaseId,
      PROFILES_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        email,
        phone,
        firstName: finalFirstName || null,
        lastName: finalLastName || null,
        name: fullName, // Keep for backward compatibility
      },
      [
        Permission.read(Role.user(userId)),
        Permission.write(Role.user(userId)),
      ]
    );

    return newProfile as Profile;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to create/update profile";
    console.error("Profile creation error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Retrieves a user's profile by userId
 * @param userId - User ID
 * @returns Promise with the profile or null if not found
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const result = await databases.listDocuments(
      databaseId,
      PROFILES_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (result.documents.length === 0) {
      return null;
    }

    return result.documents[0] as Profile;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to retrieve profile";
    console.error("Profile retrieval error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Creates a new address for a user
 * @param params - Address data
 * @returns Promise with the created address
 */
export async function createAddress(
  params: CreateAddressParams
): Promise<Address> {
  try {
    const { 
      userId, 
      label,
      parish,
      community,
      street,
      houseDetails,
      landmarkDirections,
      contactPhone,
      isDefault,
      deliveryAddress,
      latitude,
      longitude,
      formattedAddress,
      locationUpdatedAt,
    } = params;

    // Check if this is the first address - if so, automatically set as default
    const existingAddresses = await databases.listDocuments(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      [Query.equal("userId", userId)]
    );
    
    const isFirstAddress = existingAddresses.documents.length === 0;
    const finalIsDefault = isFirstAddress ? true : isDefault;

    // If this is set as default, unset other default addresses
    if (finalIsDefault) {
      await unsetDefaultAddresses(userId);
    }

    // Note: createdAt is automatically set by Appwrite
    // Permissions ensure only the user can read/write their own addresses
    const newAddress = await databases.createDocument(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        label,
        parish,
        community,
        street: street || null,
        houseDetails: houseDetails || null,
        landmarkDirections,
        contactPhone: contactPhone || null,
        default: finalIsDefault,
        deliveryAddress: deliveryAddress || formattedAddress,
        latitude,
        longitude,
        formattedAddress,
        locationUpdatedAt: locationUpdatedAt || new Date().toISOString(),
      },
      [
        Permission.read(Role.user(userId)),
        Permission.write(Role.user(userId)),
      ]
    );

    // Log audit event (non-blocking)
    logAddressCreated(userId, newAddress.$id, label).catch((error) => {
      console.warn("Failed to log address creation:", error);
    });

    // If this was auto-set as default, log the change
    if (isFirstAddress) {
      logAddressDefaultChanged(userId, newAddress.$id, undefined).catch((error) => {
        console.warn("Failed to log auto-default address change:", error);
      });
    }

    return newAddress as Address;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to create address";
    console.error("Address creation error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Retrieves all addresses for a user
 * @param userId - User ID
 * @returns Promise with array of addresses, sorted by default first, then by creation date
 */
export async function getAddresses(userId: string): Promise<Address[]> {
  try {
    const result = await databases.listDocuments(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      [Query.equal("userId", userId), Query.orderDesc("default")]
    );

    // Sort by default first, then by creation date (most recent first)
    // Note: Appwrite uses $createdAt internally, but we can sort in JavaScript
    const addresses = result.documents as Address[];
    addresses.sort((a, b) => {
      // First sort by default (true first)
      if (a.default !== b.default) {
        return a.default ? -1 : 1;
      }
      // Then sort by creation date (most recent first)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return addresses;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to retrieve addresses";
    console.error("Address retrieval error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Updates an existing address
 * @param params - Address update data
 * @returns Promise with the updated address
 */
export async function updateAddress(
  params: UpdateAddressParams
): Promise<Address> {
  try {
    const { 
      addressId, 
      label,
      parish,
      community,
      street,
      houseDetails,
      landmarkDirections,
      contactPhone,
      isDefault,
      deliveryAddress,
      latitude,
      longitude,
      formattedAddress,
      locationUpdatedAt,
    } = params;

    // Get current address to check userId
    const currentAddress = await databases.getDocument(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      addressId
    ) as Address;

    // If setting as default, unset other default addresses
    if (isDefault === true) {
      await unsetDefaultAddresses(currentAddress.userId);
    }

    const updateData: any = {};
    if (label !== undefined) updateData.label = label;
    if (parish !== undefined) updateData.parish = parish;
    if (community !== undefined) updateData.community = community;
    if (street !== undefined) updateData.street = street || null;
    if (houseDetails !== undefined) updateData.houseDetails = houseDetails || null;
    if (landmarkDirections !== undefined) updateData.landmarkDirections = landmarkDirections;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone || null;
    if (isDefault !== undefined) updateData.default = isDefault;
    if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (formattedAddress !== undefined) updateData.formattedAddress = formattedAddress;
    if (locationUpdatedAt !== undefined) updateData.locationUpdatedAt = locationUpdatedAt;

    const updatedAddress = await databases.updateDocument(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      addressId,
      updateData
    );

    // Log audit event (non-blocking)
    logAddressUpdated(currentAddress.userId, addressId, updateData).catch((error) => {
      console.warn("Failed to log address update:", error);
    });

    // If default status changed, log separately
    if (isDefault === true && !currentAddress.default) {
      // Find previous default address
      const previousDefaults = await databases.listDocuments(
        databaseId,
        ADDRESSES_COLLECTION_ID,
        [Query.equal("userId", currentAddress.userId), Query.equal("default", true), Query.limit(1)]
      ).catch(() => ({ documents: [] }));
      
      const previousDefaultId = previousDefaults.documents.find(
        (addr) => addr.$id !== addressId
      )?.$id;

      logAddressDefaultChanged(
        currentAddress.userId,
        addressId,
        previousDefaultId
      ).catch((error) => {
        console.warn("Failed to log default address change:", error);
      });
    }

    return updatedAddress as Address;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to update address";
    console.error("Address update error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Deletes an address
 * If the deleted address was the default, sets the most recent address as default
 * @param addressId - Address document ID
 * @returns Promise that resolves when address is deleted
 */
export async function deleteAddress(addressId: string): Promise<void> {
  try {
    // Get the address to check if it's default and get userId
    const address = await databases.getDocument(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      addressId
    ) as Address;

    const wasDefault = address.default;
    const userId = address.userId;

    // Delete the address
    await databases.deleteDocument(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      addressId
    );

    // Log audit event (non-blocking)
    logAddressDeleted(userId, addressId).catch((error) => {
      console.warn("Failed to log address deletion:", error);
    });

    // After deletion, check remaining addresses
    try {
      const remainingAddressesResult = await databases.listDocuments(
        databaseId,
        ADDRESSES_COLLECTION_ID,
        [Query.equal("userId", userId)]
      );

      if (remainingAddressesResult.documents.length > 0) {
        // If only one address remains, automatically set it as default
        if (remainingAddressesResult.documents.length === 1) {
          const remainingAddress = remainingAddressesResult.documents[0] as Address;
          if (!remainingAddress.default) {
            await databases.updateDocument(
              databaseId,
              ADDRESSES_COLLECTION_ID,
              remainingAddress.$id,
              { default: true }
            );

            // Log default change (non-blocking)
            logAddressDefaultChanged(userId, remainingAddress.$id, addressId).catch((error) => {
              console.warn("Failed to log auto-default address change:", error);
            });
          }
        } else if (wasDefault) {
          // If deleted address was default and multiple addresses remain, set most recent as default
          const remainingAddresses = remainingAddressesResult.documents as Address[];
          remainingAddresses.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          });

          const mostRecentAddress = remainingAddresses[0];
          await databases.updateDocument(
            databaseId,
            ADDRESSES_COLLECTION_ID,
            mostRecentAddress.$id,
            { default: true }
          );

          // Log default change (non-blocking)
          logAddressDefaultChanged(userId, mostRecentAddress.$id, addressId).catch((error) => {
            console.warn("Failed to log default address change:", error);
          });
        }
      }
    } catch (error: any) {
      // Log but don't throw - deletion succeeded, default update is secondary
      console.warn("Failed to set new default address after deletion:", error.message);
    }
  } catch (error: any) {
    const errorMessage = error.message || "Failed to delete address";
    console.error("Address deletion error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Sets an address as the default address for a user
 * Unsets all other addresses for that user
 * @param userId - User ID
 * @param addressId - Address document ID to set as default
 * @returns Promise with the updated address
 */
export async function setDefaultAddress(
  userId: string,
  addressId: string
): Promise<Address> {
  try {
    // Unset all other default addresses
    await unsetDefaultAddresses(userId);

    // Get previous default address for audit log
    const previousDefaults = await databases.listDocuments(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      [Query.equal("userId", userId), Query.equal("default", true), Query.limit(1)]
    ).catch(() => ({ documents: [] }));

    const previousDefaultId = previousDefaults.documents.find(
      (addr) => addr.$id !== addressId
    )?.$id;

    // Set this address as default
    const updatedAddress = await databases.updateDocument(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      addressId,
      {
        default: true,
      }
    );

    // Log audit event (non-blocking)
    logAddressDefaultChanged(userId, addressId, previousDefaultId).catch((error) => {
      console.warn("Failed to log default address change:", error);
    });

    return updatedAddress as Address;
  } catch (error: any) {
    const errorMessage = error.message || "Failed to set default address";
    console.error("Set default address error:", errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Helper function to unset all default addresses for a user
 * @param userId - User ID
 */
async function unsetDefaultAddresses(userId: string): Promise<void> {
  try {
    // Get all addresses for this user that are currently default
    const result = await databases.listDocuments(
      databaseId,
      ADDRESSES_COLLECTION_ID,
      [Query.equal("userId", userId), Query.equal("default", true)]
    );

    // Unset each default address
    for (const address of result.documents) {
      await databases.updateDocument(
        databaseId,
        ADDRESSES_COLLECTION_ID,
        address.$id,
        {
          default: false,
        }
      );
    }
  } catch (error: any) {
    // Log but don't throw - this is a helper function
    console.warn("Failed to unset default addresses:", error.message);
  }
}

