export interface MaterialCheckoutInputs {
  addressId: string;
  cartRevision: string;
  paymentMethod: string;
}

export function materialInputsMatch(left: MaterialCheckoutInputs, right: MaterialCheckoutInputs): boolean {
  return left.addressId === right.addressId && left.cartRevision === right.cartRevision && left.paymentMethod === right.paymentMethod;
}

export function reusableAttempt<T extends { state: string; request: MaterialCheckoutInputs }>(
  persisted: T | null,
  inputs: MaterialCheckoutInputs
): T | null {
  return persisted && persisted.state !== "succeeded" && materialInputsMatch(persisted.request, inputs) ? persisted : null;
}

export class SubmissionGate {
  private active = false;
  enter(): boolean { if (this.active) return false; this.active = true; return true; }
  leave(): void { this.active = false; }
}

export async function finishSuccessfulCheckout(
  reconcile: () => Promise<unknown>,
  navigate: () => void,
  reportReconciliationFailure: (error: unknown) => void
): Promise<void> {
  try { await reconcile(); } catch (error) { reportReconciliationFailure(error); }
  navigate();
}
