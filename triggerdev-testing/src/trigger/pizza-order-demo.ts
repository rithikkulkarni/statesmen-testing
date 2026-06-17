import { logger, metadata, retry, task, wait } from "@trigger.dev/sdk/v3";

type PizzaSize = "small" | "medium" | "large";

type PizzaOrderPayload = {
  customerName?: string;
  pizza?: string;
  size?: PizzaSize;
  address?: string;
  simulate?: {
    paymentRetry?: boolean;
    deliveryDelay?: boolean;
  };
};

type PizzaOrder = Required<Omit<PizzaOrderPayload, "simulate">> & {
  simulate: Required<NonNullable<PizzaOrderPayload["simulate"]>>;
};

type StepStatus = "pending" | "running" | "complete" | "needs-attention";

type OrderStep = {
  name: string;
  status: StepStatus;
};

const orderSteps: OrderStep[] = [
  { name: "Take order", status: "pending" },
  { name: "Charge payment", status: "pending" },
  { name: "Make pizza", status: "pending" },
  { name: "Bake pizza", status: "pending" },
  { name: "Deliver order", status: "pending" },
];

export const pizzaOrderDemoTask = task({
  id: "pizza-order-demo",
  maxDuration: 300,
  retry: {
    // If the whole task crashes unexpectedly, Trigger.dev can retry the run.
    maxAttempts: 3,
  },
  run: async (payload: PizzaOrderPayload = {}) => {
    const order = normalizeOrder(payload);
    const steps = orderSteps.map((step) => ({ ...step }));

    // Metadata shows live progress in the Trigger.dev dashboard.
    await publishOrderProgress(steps, 0, "Starting pizza order", "running");

    logger.info("Pizza order started", {
      customerName: order.customerName,
      pizza: order.pizza,
      size: order.size,
      address: order.address,
    });

    // Step 1: Take the customer's order.
    await runOrderStep(steps, 0, async () => {
      logger.info("Taking the order");
      await wait.for({ seconds: 1 });

      return {
        orderNumber: `PIZZA-${Math.floor(1000 + Math.random() * 9000)}`,
        estimatedMinutes: order.simulate.deliveryDelay ? 40 : 25,
      };
    });

    // Step 2: Charge the customer. The first attempt can fail on purpose,
    // then retry.onThrow retries just this payment block.
    const payment = await runOrderStep(steps, 1, async () => {
      logger.info("Charging payment");

      return await retry.onThrow(
        async ({ attempt }) => {
          await wait.for({ seconds: 1 });

          if (order.simulate.paymentRetry && attempt === 1) {
            logger.warn("Payment machine had a temporary problem", {
              attempt,
            });
            throw new Error("Temporary payment network error");
          }

          return {
            status: "paid",
            amount: priceFor(order.size),
            attemptsNeeded: attempt,
          };
        },
        {
          maxAttempts: 3,
          minTimeoutInMs: 500,
          maxTimeoutInMs: 2_000,
          factor: 2,
        }
      );
    });

    // Step 3: Make the pizza.
    await runOrderStep(steps, 2, async () => {
      logger.info("Making the pizza");
      await wait.for({ seconds: 2 });

      return {
        toppingsReady: true,
        pizza: `${order.size} ${order.pizza}`,
      };
    });

    // Step 4: Bake the pizza.
    await runOrderStep(steps, 3, async () => {
      logger.info("Baking the pizza");
      await wait.for({ seconds: 3 });

      return {
        ovenTemperature: "475F",
        baked: true,
      };
    });

    // Step 5: Deliver the order. A delay can be simulated so the dashboard
    // shows a temporary "needs-attention" state before continuing.
    const delivery = await runOrderStep(steps, 4, async () => {
      logger.info("Sending the driver");

      if (order.simulate.deliveryDelay) {
        await markOrderNeedsAttention(
          steps,
          80,
          "Driver is waiting at a red light"
        );
        await wait.for({ seconds: 3 });
      }

      await wait.for({ seconds: 2 });

      return {
        status: "delivered",
        deliveredTo: order.address,
      };
    });

    // Final dashboard update once every workflow step is complete.
    await publishOrderProgress(steps, 100, "Pizza delivered", "complete");

    const receipt = {
      message: `Enjoy your ${order.size} ${order.pizza}, ${order.customerName}!`,
      payment,
      delivery,
    };

    logger.info("Pizza order complete", receipt);

    return receipt;
  },
});

// Wraps each workflow step with progress updates, logging, and failure handling.
async function runOrderStep<T>(
  steps: OrderStep[],
  index: number,
  action: () => Promise<T>
) {
  const stepName = steps[index].name;

  return await logger.trace(
    `Step ${index + 1}: ${stepName}`,
    async (span) => {
      span.setAttribute("pizza.step.name", stepName);
      span.setAttribute("pizza.step.number", index + 1);

      await publishOrderProgress(steps, progressFor(index), stepName, "running");

      try {
        const result = await action();
        await publishOrderProgress(
          steps,
          progressFor(index + 1),
          stepName,
          "complete"
        );
        return result;
      } catch (error) {
        await publishOrderProgress(
          steps,
          progressFor(index),
          stepName,
          "needs-attention"
        );
        logger.error("Pizza order step failed", {
          step: stepName,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    {
      attributes: {
        "pizza.step.name": stepName,
        "pizza.step.number": index + 1,
      },
    }
  );
}

async function markOrderNeedsAttention(
  steps: OrderStep[],
  progress: number,
  message: string
) {
  return await logger.trace(message, async (span) => {
    span.setAttribute("pizza.status", "needs-attention");
    await publishOrderProgress(
      steps,
      progress,
      message,
      "needs-attention"
    );
  });
}

// Sends progress, the current step, and every step's status to Trigger.dev.
async function publishOrderProgress(
  steps: OrderStep[],
  progress: number,
  currentStep: string,
  status: StepStatus
) {
  const stepIndex = steps.findIndex((step) => step.name === currentStep);

  if (stepIndex >= 0) {
    steps[stepIndex].status = status;
  }

  metadata.set("progress", progress);
  metadata.set("currentStep", currentStep);
  metadata.set("steps", steps);
  await metadata.flush();
}

// Allows the task to run with an empty payload while still accepting form input.
function normalizeOrder(payload: PizzaOrderPayload): PizzaOrder {
  return {
    customerName: payload.customerName ?? "Sam",
    pizza: payload.pizza ?? "pepperoni",
    size: payload.size ?? "large",
    address: payload.address ?? "123 Main Street",
    simulate: {
      paymentRetry: payload.simulate?.paymentRetry ?? true,
      deliveryDelay: payload.simulate?.deliveryDelay ?? true,
    },
  };
}

function priceFor(size: PizzaSize) {
  const prices: Record<PizzaSize, number> = {
    small: 12,
    medium: 16,
    large: 20,
  };

  return prices[size];
}

function progressFor(completedSteps: number) {
  return Math.round((completedSteps / orderSteps.length) * 100);
}
