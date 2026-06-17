"use client";

import { FormEvent, useState } from "react";

type PizzaSize = "small" | "medium" | "large";

type ApiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; runId: string }
  | { status: "error"; message: string };

export default function Home() {
  const [customerName, setCustomerName] = useState("Alex");
  const [pizza, setPizza] = useState("mushroom");
  const [size, setSize] = useState<PizzaSize>("medium");
  const [address, setAddress] = useState("500 Park Ave");
  const [paymentRetry, setPaymentRetry] = useState(true);
  const [deliveryDelay, setDeliveryDelay] = useState(true);
  const [apiState, setApiState] = useState<ApiState>({ status: "idle" });

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiState({ status: "loading" });

    const response = await fetch("/api/pizza-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerName,
        pizza,
        size,
        address,
        simulate: {
          paymentRetry,
          deliveryDelay,
        },
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setApiState({
        status: "error",
        message: body.error ?? "Could not start the pizza order.",
      });
      return;
    }

    setApiState({ status: "success", runId: body.runId });
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-8 text-[#202124] sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-[#d9dee7] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c62828]">
              Trigger.dev demo
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Start a pizza order
            </h1>
          </div>

          <form className="grid gap-5" onSubmit={submitOrder}>
            <label className="grid gap-2 text-sm font-medium">
              Customer name
              <input
                className="h-11 rounded-md border border-[#cfd7e3] px-3 text-base outline-none transition focus:border-[#c62828] focus:ring-2 focus:ring-[#c62828]/20"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Pizza
              <input
                className="h-11 rounded-md border border-[#cfd7e3] px-3 text-base outline-none transition focus:border-[#c62828] focus:ring-2 focus:ring-[#c62828]/20"
                value={pizza}
                onChange={(event) => setPizza(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Size
              <select
                className="h-11 rounded-md border border-[#cfd7e3] bg-white px-3 text-base outline-none transition focus:border-[#c62828] focus:ring-2 focus:ring-[#c62828]/20"
                value={size}
                onChange={(event) => setSize(event.target.value as PizzaSize)}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Delivery address
              <input
                className="h-11 rounded-md border border-[#cfd7e3] px-3 text-base outline-none transition focus:border-[#c62828] focus:ring-2 focus:ring-[#c62828]/20"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
              />
            </label>

            <div className="grid gap-3 rounded-lg border border-[#d9dee7] bg-[#f7faf7] p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  className="size-4 accent-[#2e7d32]"
                  type="checkbox"
                  checked={paymentRetry}
                  onChange={(event) => setPaymentRetry(event.target.checked)}
                />
                Simulate payment retry
              </label>

              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  className="size-4 accent-[#2e7d32]"
                  type="checkbox"
                  checked={deliveryDelay}
                  onChange={(event) => setDeliveryDelay(event.target.checked)}
                />
                Simulate delivery delay
              </label>
            </div>

            <button
              className="mt-2 h-12 rounded-md bg-[#c62828] px-5 text-base font-semibold text-white transition hover:bg-[#a61f1f] disabled:cursor-not-allowed disabled:bg-[#d99a9a]"
              disabled={apiState.status === "loading"}
              type="submit"
            >
              {apiState.status === "loading" ? "Starting order..." : "Start order"}
            </button>
          </form>
        </section>

        <aside className="rounded-lg border border-[#d9dee7] bg-[#1f2937] p-6 text-white shadow-sm">
          <h2 className="text-xl font-semibold">Order status</h2>

          <div className="mt-6 rounded-md bg-white/10 p-4">
            {apiState.status === "idle" && (
              <p className="text-sm text-white/75">
                Submit the form to create a Trigger.dev run.
              </p>
            )}

            {apiState.status === "loading" && (
              <p className="text-sm text-white/75">Sending order...</p>
            )}

            {apiState.status === "success" && (
              <div className="grid gap-3">
                <p className="text-sm text-white/75">Trigger.dev run created.</p>
                <p className="break-all rounded-md bg-black/30 p-3 font-mono text-sm">
                  {apiState.runId}
                </p>
              </div>
            )}

            {apiState.status === "error" && (
              <p className="text-sm text-[#ffcdd2]">{apiState.message}</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
