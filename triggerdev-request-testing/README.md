# Pizza Order Trigger Demo

This Next.js app starts the `pizza-order-demo` task from the sibling
`triggerdev-testing` project.

## Setup

Create `triggerdev-request-testing/.env.local` with your Trigger.dev secret key:

```env
TRIGGER_SECRET_KEY=tr_dev_or_prod_secret_key_here
```

Use a secret key from the same Trigger.dev project/environment that is running
the `pizza-order-demo` task.

## Run The Demo

In one terminal, start the Trigger.dev worker:

```powershell
cd ..\triggerdev-testing
.\node_modules\.bin\trigger.cmd dev
```

In another terminal, start this web app:

```powershell
cd ..\triggerdev-request-testing
npm.cmd run dev
```

Open `http://localhost:3000`, fill out the pizza form, and submit it. The page
will show the Trigger.dev run ID after the task is created.
