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

type CashfreeCheckout = {
  checkout: (options: { paymentSessionId: string; redirectTarget: string }) => Promise<{ error?: { message?: string }; paymentDetails?: { paymentMessage?: string } }>;
  subscriptionsCheckout?: (options: { subsSessionId: string; redirectTarget: string }) => Promise<{ error?: { message?: string }; paymentDetails?: { paymentMessage?: string } }>;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeCheckout;
  }
}

function loadCashfree(): Promise<boolean> {
  if (window.Cashfree) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openCashfreeCheckout(input: {
  environment: "sandbox" | "production";
  paymentSessionId?: string;
  subscriptionSessionId?: string;
}): Promise<void> {
  const ok = await loadCashfree();
  if (!ok || !window.Cashfree) throw new Error("Payment checkout could not be opened.");
  if (input.environment !== "sandbox" && input.environment !== "production") {
    throw new Error("Payment could not be started.");
  }
  const cashfree = window.Cashfree({ mode: input.environment });
  const result = input.subscriptionSessionId
    ? await cashfree.subscriptionsCheckout?.({ subsSessionId: input.subscriptionSessionId, redirectTarget: "_modal" })
    : await cashfree.checkout({ paymentSessionId: input.paymentSessionId || "", redirectTarget: "_modal" });
  if (!result) throw new Error("Payment checkout could not be opened.");
  if (result.error) throw new Error(result.error.message || "Payment was closed.");
}

declare global {
  interface Window {
    PhonePeCheckout?: {
      transact: (options: {
        tokenUrl: string;
        type?: string;
        callback?: (response: string) => void;
      }) => void;
      closePage?: () => void;
    };
  }
}

function loadPhonePe(scriptUrl: string): Promise<boolean> {
  if (window.PhonePeCheckout?.transact) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.PhonePeCheckout?.transact)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve(Boolean(window.PhonePeCheckout?.transact));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** PhonePe website Standard Checkout (iframe PayPage). */
export async function openPhonePeCheckout(input: {
  redirectUrl: string;
  checkoutScript: string;
}): Promise<void> {
  const ok = await loadPhonePe(input.checkoutScript);
  if (!ok || !window.PhonePeCheckout?.transact) {
    throw new Error("Payment checkout could not be opened.");
  }
  await new Promise<void>((resolve, reject) => {
    window.PhonePeCheckout!.transact({
      tokenUrl: input.redirectUrl,
      type: "IFRAME",
      callback: (response) => {
        if (response === "USER_CANCEL") {
          reject(new Error("Payment was closed."));
          return;
        }
        resolve();
      },
    });
  });
}
