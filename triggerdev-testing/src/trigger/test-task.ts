import { logger, metadata, retry, task, wait } from "@trigger.dev/sdk/v3";

type Plan = "starter" | "growth" | "enterprise";

type DemoPayload = {
  customerId?: string;
  companyName?: string;
  plan?: Plan;
  requestedBy?: string;
  contacts?: Array<{
    name: string;
    email: string;
    role: "admin" | "billing" | "technical";
  }>;
  riskScoreOverride?: number;
  simulate?: {
    paymentProviderRetry?: boolean;
    contractNeedsApproval?: boolean;
  };
};

type DemoInput = Required<Omit<DemoPayload, "simulate" | "riskScoreOverride">> & {
  riskScoreOverride?: number;
  simulate: Required<NonNullable<DemoPayload["simulate"]>>;
};

type StepStatus = "pending" | "running" | "complete" | "needs-attention";

type WorkflowStep = {
  name: string;
  status: StepStatus;
};

const defaultContacts: DemoInput["contacts"] = [
  {
    name: "Maya Chen",
    email: "maya.chen@example.com",
    role: "admin",
  },
  {
    name: "Devon Price",
    email: "devon.price@example.com",
    role: "billing",
  },
  {
    name: "Priya Shah",
    email: "priya.shah@example.com",
    role: "technical",
  },
];

const workflowSteps: WorkflowStep[] = [
  { name: "Validate intake", status: "pending" },
  { name: "Provision customer workspace", status: "pending" },
  { name: "Run risk and compliance checks", status: "pending" },
  { name: "Create billing subscription", status: "pending" },
  { name: "Send launch communications", status: "pending" },
];

export const customerOnboardingDemoTask = task({
  id: "customer-onboarding-demo",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: DemoPayload = {}) => {
    const input = normalizePayload(payload);
    const steps = workflowSteps.map((step) => ({ ...step }));

    await publishProgress(steps, 0, "Starting onboarding workflow", "running");

    logger.info("Customer onboarding demo started", {
      customerId: input.customerId,
      companyName: input.companyName,
      plan: input.plan,
      requestedBy: input.requestedBy,
    });

    await runStep(steps, 0, async () => {
      logger.info("Validating CRM intake data", {
        contacts: input.contacts.length,
      });

      await wait.for({ seconds: 2 });

      const missingBillingContact = !input.contacts.some(
        (contact) => contact.role === "billing"
      );

      if (missingBillingContact) {
        throw new Error("Customer intake must include a billing contact");
      }

      return {
        validatedContacts: input.contacts.map((contact) => contact.email),
      };
    });

    const workspace = await runStep(steps, 1, async () => {
      logger.info("Provisioning customer workspace");
      await wait.for({ seconds: 2 });

      return {
        workspaceId: `ws_${input.customerId.toLowerCase()}`,
        tenantUrl: `https://${slugify(input.companyName)}.demo-app.example`,
        enabledFeatures: featuresForPlan(input.plan),
      };
    });

    const compliance = await runStep(steps, 2, async () => {
      logger.info("Running compliance checks");
      await wait.for({ seconds: 2 });

      const riskScore =
        input.riskScoreOverride ?? calculateRiskScore(input.companyName, input.plan);

      if (riskScore >= 80 || input.simulate.contractNeedsApproval) {
        logger.warn("High-risk onboarding detected; pausing for manager review", {
          riskScore,
        });

        await publishProgress(
          steps,
          2,
          "Waiting on manager approval",
          "needs-attention"
        );

        await wait.for({ seconds: 5 });

        logger.info("Manager approval recorded for demo run");
      }

      return {
        riskScore,
        approved: true,
        checks: ["sanctions-screen", "domain-verification", "contract-review"],
      };
    });

    const billing = await runStep(steps, 3, async () => {
      logger.info("Creating billing subscription");

      const subscription = await retry.onThrow(
        async ({ attempt }) => {
          await wait.for({ seconds: 1 });

          if (input.simulate.paymentProviderRetry && attempt === 1) {
            logger.warn("Payment provider returned a transient error", {
              attempt,
            });
            throw new Error("Payment provider timeout");
          }

          return {
            subscriptionId: `sub_${input.customerId.toLowerCase()}`,
            monthlyPrice: monthlyPriceForPlan(input.plan),
            invoiceStatus: "draft",
          };
        },
        {
          maxAttempts: 3,
          minTimeoutInMs: 500,
          maxTimeoutInMs: 2_000,
          factor: 2,
        }
      );

      logger.info("Billing subscription created", subscription);

      return subscription;
    });

    const launch = await runStep(steps, 4, async () => {
      logger.info("Sending launch communications");
      await wait.for({ seconds: 2 });

      return {
        welcomeEmailSentTo: input.contacts.map((contact) => contact.email),
        kickoffMeeting: nextBusinessDay(),
        internalSlackChannel: `#launch-${slugify(input.companyName)}`,
      };
    });

    await publishProgress(steps, 100, "Onboarding complete", "complete");

    const result = {
      customerId: input.customerId,
      companyName: input.companyName,
      plan: input.plan,
      workspace,
      compliance,
      billing,
      launch,
      demoTalkingPoints: [
        "The run is observable from start to finish with logs and metadata.",
        "Long waits do not need to live inside a web request.",
        "Transient vendor failures can retry without restarting the whole workflow.",
        "The final return value becomes an auditable handoff report.",
      ],
    };

    logger.info("Customer onboarding demo complete", result);

    return result;
  },
});

async function runStep<T>(
  steps: WorkflowStep[],
  index: number,
  action: () => Promise<T>
) {
  await publishProgress(steps, progressFor(index), steps[index].name, "running");

  try {
    const result = await action();
    await publishProgress(
      steps,
      progressFor(index + 1),
      steps[index].name,
      "complete"
    );
    return result;
  } catch (error) {
    await publishProgress(
      steps,
      progressFor(index),
      steps[index].name,
      "needs-attention"
    );
    logger.error("Workflow step failed", {
      step: steps[index].name,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function publishProgress(
  steps: WorkflowStep[],
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

function normalizePayload(payload: DemoPayload): DemoInput {
  return {
    customerId: payload.customerId ?? "ACME-2026",
    companyName: payload.companyName ?? "Acme Insurance Group",
    plan: payload.plan ?? "enterprise",
    requestedBy: payload.requestedBy ?? "sales@statesmen.example",
    contacts: payload.contacts?.length ? payload.contacts : defaultContacts,
    riskScoreOverride: payload.riskScoreOverride,
    simulate: {
      paymentProviderRetry: payload.simulate?.paymentProviderRetry ?? true,
      contractNeedsApproval: payload.simulate?.contractNeedsApproval ?? true,
    },
  };
}

function progressFor(completedSteps: number) {
  return Math.round((completedSteps / workflowSteps.length) * 100);
}

function featuresForPlan(plan: Plan) {
  const featuresByPlan: Record<Plan, string[]> = {
    starter: ["core-dashboard", "email-support"],
    growth: ["core-dashboard", "email-support", "team-seats", "api-access"],
    enterprise: [
      "core-dashboard",
      "priority-support",
      "team-seats",
      "api-access",
      "sso",
      "audit-log-export",
    ],
  };

  return featuresByPlan[plan];
}

function monthlyPriceForPlan(plan: Plan) {
  const prices: Record<Plan, number> = {
    starter: 499,
    growth: 1_499,
    enterprise: 4_999,
  };

  return prices[plan];
}

function calculateRiskScore(companyName: string, plan: Plan) {
  const planScore: Record<Plan, number> = {
    starter: 25,
    growth: 45,
    enterprise: 70,
  };

  return planScore[plan] + Math.min(companyName.length, 20);
}

function nextBusinessDay() {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
