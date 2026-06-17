import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

type PizzaOrderPayload = {
  customerName: string;
  pizza: string;
  size: "small" | "medium" | "large";
  address: string;
  simulate: {
    paymentRetry: boolean;
    deliveryDelay: boolean;
  };
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    return NextResponse.json(
      {
        error:
          "Missing TRIGGER_SECRET_KEY. Add it to triggerdev-request-testing/.env.local.",
      },
      { status: 500 }
    );
  }

  const payload = await request.json();
  const validationError = getPayloadValidationError(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const order = payload as PizzaOrderPayload;

  try {
    const run = await tasks.trigger("pizza-order-demo", order, {
      tags: ["pizza-demo", order.size],
      metadata: {
        requestedFrom: "next-demo-form",
        customerName: order.customerName,
      },
    });

    return NextResponse.json({
      runId: run.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not trigger the pizza order task.",
      },
      { status: 500 }
    );
  }
}

function getPayloadValidationError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a pizza order.";
  }

  const order = payload as Partial<PizzaOrderPayload>;
  const validSizes = ["small", "medium", "large"];

  const isValid =
    typeof order.customerName === "string" &&
    order.customerName.trim().length > 0 &&
    typeof order.pizza === "string" &&
    order.pizza.trim().length > 0 &&
    typeof order.address === "string" &&
    order.address.trim().length > 0 &&
    typeof order.size === "string" &&
    validSizes.includes(order.size) &&
    typeof order.simulate === "object" &&
    order.simulate !== null &&
    typeof order.simulate.paymentRetry === "boolean" &&
    typeof order.simulate.deliveryDelay === "boolean";

  return isValid ? null : "Check the pizza order fields and try again.";
}
