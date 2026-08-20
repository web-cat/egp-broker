# Deploying EGP Broker on Kubernetes via Rancher

This guide walks you through deploying **PostgreSQL** and the **EGP Broker** application as two workloads on a Kubernetes cluster using the **Rancher 2.11 Cluster Explorer UI**. All steps are performed through the Rancher web interface—no `kubectl` commands required.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Kubernetes Namespace: egp-broker                           │
│                                                             │
│  ┌──────────────┐       ┌──────────────────────────────┐    │
│  │  Secret:     │──────▶│  StatefulSet: postgres       │    │
│  │  egp-broker- │       │  Image: postgres:18-alpine   │    │
│  │  env         │       │  Port: 5432                  │    │
│  │  (shared)    │       │  PVC: 100Gi (ceph-rbd)       │    │
│  │              │       └──────────┬───────────────────┘    │
│  │              │                  │                        │
│  │              │       ┌──────────▼───────────────────┐    │
│  │              │       │  Headless Service: postgres  │    │
│  │              │       │  ClusterIP: None             │    │
│  │              │       │  Port: 5432                  │    │
│  │              │       └──────────────────────────────┘    │
│  │              │                                           │
│  │              │       ┌──────────────────────────────┐    │
│  │              │──────▶│  Deployment: egp-broker      │    │
│  │              │       │  Image: docker.cs.vt.edu/... │    │
│  │              │       │  Port: 3000                  │    │
│  └──────────────┘       └──────────┬───────────────────┘    │
│                                    │                        │
│                         ┌──────────▼───────────────────┐    │
│                         │  Service: egp-broker         │    │
│                         │  ClusterIP (auto)            │    │
│                         │  Port: 80 → 3000             │    │
│                         └──────────┬───────────────────┘    │
│                                    │                        │
│                         ┌──────────▼───────────────────┐    │
│                         │  Ingress: egp-broker-ingress │    │
│                         │  Host: egp-broker.cs.vt.edu  │    │
│                         │  TLS: enabled                │    │
│                         └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**What gets created:**

| Resource         | Name                        | Purpose                                                    |
| ---------------- | --------------------------- | ---------------------------------------------------------- |
| Secret           | `egp-enviroment-variables`  | Shared environment variables for both workloads            |
| Secret           | `docker-cs-vt-edu-registry` | Registry credentials for `docker.cs.vt.edu` (Pre-existing) |
| StatefulSet      | `postgres`                  | PostgreSQL database with persistent storage                |
| Headless Service | `postgres`                  | Internal DNS for the database (`postgres:5432`)            |
| Deployment       | `egp-broker`                | The Nuxt application (production build)                    |
| Service          | `egp-broker`                | Internal load balancer for the app                         |
| Ingress          | `egp-broker-ingress`        | External HTTPS access at `egp-broker.cs.vt.edu`            |

---

## Prerequisites

Before starting, make sure the following are in place:

- [ ] Access to Rancher at your organization's URL, with permissions to create resources in the **egp-broker** project/namespace.
- [x] A Rancher **Registry Secret** named `docker-cs-vt-edu-registry` already exists that grants pull access to `docker.cs.vt.edu`.
- [x] The **egp-broker** production Docker image has been built and pushed to `docker.cs.vt.edu/stedwar2/egp-broker:<version>`.
- [x] The cluster has the `ceph-rbd` StorageClass available (default).
- [x] TLS certificates are installed on the cluster for `egp-broker.cs.vt.edu`.
- [ ] You have your environment variable values ready (database password, session password, SMTP credentials, LTI keys, etc.). See [Appendix A](#appendix-a-environment-variable-reference) for the full list.

---

## Step 1: Navigate to the EGP Broker Namespace

1. Log in to Rancher.
2. From the **Home** page, click on your cluster name to open the **Cluster Explorer**.
3. At the top of the page, find the **namespace dropdown** (it may say "All Namespaces" or a specific namespace). Click it and select **egp-broker**.

> [!IMPORTANT]
> Make sure `egp-broker` is selected as your active namespace for all subsequent steps. If you create resources in the wrong namespace, they won't be able to find each other.

---

## Step 2: Create the Shared Secret

This secret stores all environment variables used by both the PostgreSQL and EGP Broker workloads.

1. In the left sidebar, navigate to **Storage → Secrets**.
2. Click **Create** in the top-right corner.
3. Select **Opaque** as the secret type.
4. Fill in the form:
   - **Name:** `egp-enviroment-variables`
   - **Namespace:** `egp-broker` (should already be selected)

5. Under **Data**, add the following key-value pairs. Click **Add** for each new entry:

   | Key                              | Example Value                                                 | Notes                                                                                                                           |
   | -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
   | `POSTGRES_DB`                    | `egpbroker`                                                   | Database name                                                                                                                   |
   | `POSTGRES_USER`                  | `postgres`                                                    | Database user                                                                                                                   |
   | `POSTGRES_PASSWORD`              | _(your strong password)_                                      | Database password                                                                                                               |
   | `NUXT_DATABASE_URL`              | `postgresql://postgres:YOUR_PASSWORD@postgres:5432/egpbroker` | **Replace** `YOUR_PASSWORD` with the actual password. The hostname `postgres` refers to the headless service created in Step 3. |
   | `NUXT_SITE_URL`                  | `https://egp-broker.cs.vt.edu`                                | Public URL of the app                                                                                                           |
   | `NUXT_SITE_NAME`                 | `EGP Broker`                                                  | Display name                                                                                                                    |
   | `NODE_ENV`                       | `production`                                                  | **Must be `production`**                                                                                                        |
   | `NUXT_SESSION_PASSWORD`          | _(32+ character random string)_                               | Generate with:`openssl rand -base64 32`                                                                                         |
   | `NUXT_RATE_LIMIT_LOGIN_MAX`      | `5`                                                           | Max login attempts                                                                                                              |
   | `NUXT_RATE_LIMIT_LOGIN_WINDOW`   | `15`                                                          | Window in minutes                                                                                                               |
   | `NUXT_RATE_LIMIT_TOKEN_COOLDOWN` | `5`                                                           | Cooldown in minutes                                                                                                             |
   | `NUXT_EMAIL_HOST`                | `antispam.cs.vt.edu`                                          | SMTP server                                                                                                                     |
   | `NUXT_EMAIL_PORT`                | `587`                                                         | SMTP port                                                                                                                       |
   | `NUXT_EMAIL_SECURE`              | `false`                                                       | `true` for port 465 only                                                                                                        |
   | `NUXT_EMAIL_USER`                | _(your email)_                                                | SMTP username                                                                                                                   |
   | `NUXT_LTI_PRIVATE_KEY`           | _(your PKCS8 private key, with literal `\n` for newlines)_    | See[Appendix B](#appendix-b-generating-lti-keys)                                                                                |
   | `NUXT_LTI_KEY_ID`                | `lti-key-1`                                                   | Identifier for the public key                                                                                                   |

> [!WARNING]
> The `NUXT_DATABASE_URL` must use `postgres` as the hostname (not `localhost` or an IP address). This is the name of the headless Kubernetes service you will create in Step 3, and Kubernetes DNS will resolve it to the PostgreSQL pod.

6. Click **Create** to save the secret.

---

## Step 3: Deploy PostgreSQL (StatefulSet + Headless Service)

PostgreSQL uses a **StatefulSet** (not a Deployment) because it needs stable storage that survives pod restarts. A **headless service** gives the PostgreSQL pod a stable DNS name (`postgres`) that the app can connect to.

### 3a: Import the Headless Service and StatefulSet

1. In the top-right corner of the Cluster Explorer, click the **Import YAML** button (the `⬆` icon, or look for a button labeled **Import YAML**).
2. Make sure the **Namespace** dropdown at the top of the import dialog is set to **egp-broker**.
3. Paste the following YAML into the editor:

```yaml
# ============================================================
# Headless Service for PostgreSQL
# This gives the StatefulSet a stable DNS name: "postgres"
# Other pods in the namespace can reach it at postgres:5432
# ============================================================
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: egp-broker
  labels:
    app: postgres
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
    - name: postgresql
      port: 5432
      targetPort: 5432
---
# ============================================================
# PostgreSQL StatefulSet
# A single-replica database with persistent storage
# ============================================================
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: egp-broker
  labels:
    app: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:18-alpine
          ports:
            - containerPort: 5432
              name: postgresql
          envFrom:
            - secretRef:
                name: egp-enviroment-variables
          env:
            # Tell PostgreSQL to use a subdirectory for data.
            # This avoids errors from the "lost+found" directory
            # that Ceph/ext4 volumes create at the mount root.
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: egp-postgres-data
              mountPath: /var/lib/postgresql/data
          readinessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - postgres
                - -d
                - egpbroker
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - postgres
                - -d
                - egpbroker
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: egp-postgres-data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: ceph-rbd
        resources:
          requests:
            storage: 100Gi
```

4. Click **Import** to create both resources.

### 3b: Verify PostgreSQL Is Running

1. In the left sidebar, navigate to **Workloads → StatefulSets**.
2. You should see `postgres` with **1/1** ready replicas. It may take a minute for the pod to start and the PVC to be provisioned.
3. If the pod shows an error, click on it to view the logs and troubleshoot.

> [!TIP]
> If the pod is stuck in `Pending`, click on it and check the **Events** tab. Common causes are: the `ceph-rbd` StorageClass not being available, or capacity issues. If it shows `ImagePullBackOff`, the postgres image may not be reachable—check your cluster's internet connectivity.

---

## Step 4: Deploy EGP Broker (Deployment + Service)

The application runs as a standard **Deployment** with a **ClusterIP Service** that the Ingress will route traffic to.

### 4a: Import the Deployment and Service

1. Click the **Import YAML** button again (top-right).
2. Ensure the **Namespace** is set to **egp-broker**.
3. Paste the following YAML, **replacing** `<version>` with the image tag you want to deploy (e.g., `0.0.1` or `latest`):

```yaml
# ============================================================
# ClusterIP Service for EGP Broker
# Routes internal traffic to the app pods on port 3000
# ============================================================
apiVersion: v1
kind: Service
metadata:
  name: egp-broker
  namespace: egp-broker
  labels:
    app: egp-broker
spec:
  type: ClusterIP
  selector:
    app: egp-broker
  ports:
    - name: http
      port: 80
      targetPort: 3000
---
# ============================================================
# EGP Broker Deployment
# The Nuxt production application
# ============================================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: egp-broker
  namespace: egp-broker
  labels:
    app: egp-broker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: egp-broker
  template:
    metadata:
      labels:
        app: egp-broker
    spec:
      # Reference your existing registry credentials secret
      # so Kubernetes can pull from docker.cs.vt.edu
      imagePullSecrets:
        - name: docker-cs-vt-edu-registry
      containers:
        - name: egp-broker
          image: docker.cs.vt.edu/stedwar2/egp-broker:<version>
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - secretRef:
                name: egp-enviroment-variables
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 60
            periodSeconds: 15
            timeoutSeconds: 5
```

> [!IMPORTANT]
> You **must** edit the `<version>` placeholder in the YAML (e.g., `0.0.1`) before importing.

4. Click **Import** to create both resources.

### 4b: Verify EGP Broker Is Running

1. In the left sidebar, navigate to **Workloads → Deployments**.
2. You should see `egp-broker` with **1/1** ready replicas.
3. The first startup may take 30–60 seconds because the container runs database migrations (`prisma migrate deploy`) before starting the application server.

> [!TIP]
> If the pod keeps restarting (CrashLoopBackOff), click on the pod name, then go to the **Logs** tab. Common causes:
>
> - **`NUXT_DATABASE_URL` is wrong** — double-check the password and hostname (`postgres`).
> - **PostgreSQL isn't ready yet** — wait for the postgres StatefulSet to show 1/1, then the app pod will self-heal on its next restart.

---

## Step 5: Create the Ingress

The Ingress routes external HTTPS traffic from `egp-broker.cs.vt.edu` to the EGP Broker service.

1. Click the **Import YAML** button again (top-right).
2. Ensure the **Namespace** is set to **egp-broker**.
3. Paste the following YAML:

```yaml
# ============================================================
# Ingress for EGP Broker
# Routes external HTTPS traffic to the app service
# ============================================================
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: egp-broker-ingress
  namespace: egp-broker
  labels:
    app: egp-broker
  annotations:
    # Allow large request bodies (needed for LTI token POSTs)
    nginx.ingress.kubernetes.io/proxy-body-size: '10m'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - egp-broker.cs.vt.edu
  rules:
    - host: egp-broker.cs.vt.edu
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: egp-broker
                port:
                  number: 80
```

> [!NOTE]
> This Ingress configuration assumes:
>
> - The cluster uses an **nginx** ingress controller (common in Rancher). If your cluster uses a different ingress controller (e.g., Traefik), change the `ingressClassName` accordingly.
> - TLS certificates for `egp-broker.cs.vt.edu` are already installed at the cluster level (wildcard or specific). If you need to reference a specific TLS secret, add a `secretName` field under the `tls` entry.

4. Click **Import** to create the Ingress.

### Verify the Ingress

1. In the left sidebar, navigate to **Service Discovery → Ingresses**.
2. You should see `egp-broker-ingress` with the host `egp-broker.cs.vt.edu`.
3. Open `https://egp-broker.cs.vt.edu` in your browser. You should see the EGP Broker login page.

---

## Step 6: Verify the Full Stack

Run through this checklist to confirm everything is working:

- [ ] **PostgreSQL:** Workloads → StatefulSets → `postgres` shows **1/1** ready.
- [ ] **EGP Broker:** Workloads → Deployments → `egp-broker` shows **1/1** ready.
- [ ] **Services:** Service Discovery → Services shows both `postgres` and `egp-broker`.
- [ ] **Ingress:** Service Discovery → Ingresses shows `egp-broker-ingress` with host `egp-broker.cs.vt.edu`.
- [ ] **Browser:** `https://egp-broker.cs.vt.edu` loads the EGP Broker login page.

---

## Optional: Database Seeding

After the workloads are running, you can optionally seed the database with test data. This creates demo users, sample courses, assignments, and pass types.

1. In the left sidebar, navigate to **Workloads → Deployments**.
2. Click on the **egp-broker** deployment name.
3. In the pod list, click the name of the running pod (e.g., `egp-broker-xxxxxxxxx-xxxxx`).
4. In the top-right of the pod detail page, click the **Execute Shell** button (terminal icon `>_`).
5. In the terminal that opens, run:

   ```sh
   npx prisma db seed
   ```

6. You should see output like:

   ```
   🌱 Starting database seeding...
   ✅ Existing data deleted
   ✅ 2 test users created
   ✅ LTI platform and deployment created
   ...
   🎉 Seeding completed successfully!
   ```

> [!CAUTION]
> The seed script **deletes all existing data** before inserting test records. Only run this on a fresh deployment or when you intentionally want to reset the database.

The seed script creates two users:

- **Admin:** `admin@example.com` / `Admin123!`
- **Demo:** `demo@example.com` / `Demo123!`

---

## Updating the Application

To deploy a new version of EGP Broker:

1. Build and push the new image to `docker.cs.vt.edu/stedwar2/egp-broker:<new-version>`.
2. In Rancher, navigate to **Workloads → Deployments**.
3. Click the **⋮** (three-dot menu) next to `egp-broker` and select **Edit Config**.
4. In the **Container Image** field, update the tag to the new version.
5. Click **Save**. Rancher will perform a rolling update—the old pod stays running until the new one is healthy.

Database migrations run automatically on startup (`prisma migrate deploy`), so schema changes are applied as part of the update.

---

## Troubleshooting

### Pod stuck in `Pending`

**Cause:** Usually a storage provisioning issue.

**Fix:** Click the pod → **Events** tab. If the PVC can't be bound, check that the `ceph-rbd` StorageClass exists (Storage → StorageClasses).

### Pod in `CrashLoopBackOff`

**Cause:** The container starts but immediately crashes.

**Fix:** Click the pod → **Logs** tab. Common issues:

- Database connection refused → PostgreSQL isn't ready yet (wait and let Kubernetes retry).
- Invalid `NUXT_DATABASE_URL` → Edit the secret (Storage → Secrets → `egp-enviroment-variables`) and fix the connection string.
- Migration error → Usually a schema conflict. Check the log output for the specific Prisma error.

### Pod in `ImagePullBackOff`

**Cause:** Kubernetes can't pull the Docker image.

**Fix:** Verify:

- The image name and tag are correct.
- The `imagePullSecrets` name in the Deployment YAML matches your actual registry secret name.
- The registry secret is in the `egp-broker` namespace.

### App loads but shows errors

- Check that `NUXT_SITE_URL` is set to `https://egp-broker.cs.vt.edu` (not `http://`).
- Check that `NUXT_SESSION_PASSWORD` is at least 32 characters.
- Check the pod logs for any runtime errors.

---

## Appendix A: Environment Variable Reference

| Variable                         | Required | Description                                                            |
| -------------------------------- | -------- | ---------------------------------------------------------------------- |
| `POSTGRES_DB`                    | Yes      | PostgreSQL database name (e.g.,`egpbroker`)                            |
| `POSTGRES_USER`                  | Yes      | PostgreSQL username (e.g.,`postgres`)                                  |
| `POSTGRES_PASSWORD`              | Yes      | PostgreSQL password (use a strong, random password)                    |
| `NUXT_DATABASE_URL`              | Yes      | Full connection string:`postgresql://<user>:<pass>@postgres:5432/<db>` |
| `NUXT_SITE_URL`                  | Yes      | `https://egp-broker.cs.vt.edu`                                         |
| `NUXT_SITE_NAME`                 | No       | Display name (default:`EGP Broker`)                                    |
| `NODE_ENV`                       | Yes      | Must be `production`                                                   |
| `NUXT_SESSION_PASSWORD`          | Yes      | Random string, 32+ characters                                          |
| `NUXT_RATE_LIMIT_LOGIN_MAX`      | No       | Max failed login attempts per window (default:`5`)                     |
| `NUXT_RATE_LIMIT_LOGIN_WINDOW`   | No       | Login rate limit window in minutes (default:`15`)                      |
| `NUXT_RATE_LIMIT_TOKEN_COOLDOWN` | No       | Minutes between verification emails (default:`5`)                      |
| `NUXT_EMAIL_HOST`                | Yes      | SMTP server hostname                                                   |
| `NUXT_EMAIL_PORT`                | Yes      | SMTP port (typically `587`)                                            |
| `NUXT_EMAIL_SECURE`              | No       | `true` for port 465, `false` otherwise                                 |
| `NUXT_EMAIL_USER`                | Yes      | SMTP username                                                          |
| `NUXT_EMAIL_PASS`                | No       | SMTP password or app password                                          |
| `NUXT_EMAIL_FROM`                | Yes      | Sender email address                                                   |
| `NUXT_LTI_PRIVATE_KEY`           | Yes      | RSA private key in PKCS8 format (see Appendix B)                       |
| `NUXT_LTI_KEY_ID`                | Yes      | Key identifier string (e.g.,`lti-key-1`)                               |

## Appendix B: Generating LTI Keys

If you don't already have an LTI key pair, generate one on your local machine:

```bash
# Generate a 2048-bit RSA private key in PKCS8 format
openssl genpkey -algorithm RSA -out lti_private.pem -pkeyopt rsa_keygen_bits:2048
```

To prepare the key for the Rancher secret, you need to convert newlines to literal `\n` characters so it fits on one line:

```bash
# Convert the key to a single-line format for the environment variable
awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' lti_private.pem
```

Copy the output and paste it as the value for `NUXT_LTI_PRIVATE_KEY` in the Rancher secret.
