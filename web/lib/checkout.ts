export type CheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
};

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openCheckout(options: Record<string, unknown>): Promise<CheckoutResponse> {
  const ok = await loadRazorpay();
  if (!ok || !window.Razorpay) throw new Error("Payment checkout could not be opened.");
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      ...options,
      handler: (response: CheckoutResponse) => resolve(response),
      modal: { ondismiss: () => reject(new Error("Payment was closed.")) },
    });
    checkout.open();
  });
}
