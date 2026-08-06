import { ExecutionMethod } from "appwrite";
import { functions } from "./appwrite-client";
import { Coordinates } from "./location-utils";

export const DISTANCE_FUNCTION_ID = "calculate-distance";

export interface StoreDistanceInput extends Coordinates { $id?: string; id?: string; }
export interface StoreDistance { storeId?: string; distanceKm: number; deliveryFeeJmdCents: number | null; }
export interface DistanceResponse { ok: boolean; customer: Coordinates; distances: StoreDistance[]; deliveryFee: null; error?: string; }

export async function calculateStoreDistances(customer: Coordinates, stores?: StoreDistanceInput[]): Promise<StoreDistance[]> {
  const execution = await functions.createExecution({
    functionId: DISTANCE_FUNCTION_ID,
    body: JSON.stringify({ customer, stores }),
    async: false,
    method: ExecutionMethod.POST,
    headers: { "content-type": "application/json" },
  });
  const response = JSON.parse(execution.responseBody) as DistanceResponse;
  if (!response.ok) throw new Error(response.error || "Distance calculation failed.");
  return response.distances;
}
