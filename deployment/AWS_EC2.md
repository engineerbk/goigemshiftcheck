# AWS EC2 Deployment Guide

This guide deploys the existing Docker Compose stack to one AWS EC2 instance:

- Nginx serves the Expo web build on port `80`.
- Nginx proxies `/api` to the FastAPI backend container.
- MongoDB runs as a private Docker container with a persistent Docker volume.

For a small internal shift-check app, this is the simplest AWS setup. If the app grows, move MongoDB to MongoDB Atlas or Amazon DocumentDB and run the backend on ECS/App Runner.

## 1. Create AWS Infrastructure

### 1.1. Launch EC2

Recommended starting instance:

- AMI: Ubuntu Server 24.04 LTS
- Instance type: `t3.small` or larger
- Storage: 20 GB gp3 minimum
- Key pair: create or select an SSH key

### 1.2. Security Group

Allow inbound traffic:

| Type | Port | Source | Purpose |
| --- | ---: | --- | --- |
| SSH | 22 | Your IP only | Server administration |
| HTTP | 80 | `0.0.0.0/0` | Web app and API before HTTPS |
| HTTPS | 443 | `0.0.0.0/0` | Production TLS |

Do not expose MongoDB port `27017`.

### 1.3. Allocate Elastic IP

Allocate an Elastic IP and associate it with the EC2 instance. Point your domain's `A` record to that Elastic IP.

## 2. Prepare The Server

SSH into the instance:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Install Docker and Compose:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and SSH back in so the Docker group takes effect.

## 3. Upload Or Clone The App

Clone the repo:

```bash
git clone YOUR_REPOSITORY_URL goigemshiftcheck
cd goigemshiftcheck
```

If the repository is private, configure SSH deploy keys or GitHub authentication first.

## 4. Configure Environment

Create the Compose environment file:

```bash
cd deployment
cp .env.example .env
```

Edit `deployment/.env`:

```bash
MONGO_URL=mongodb://mongo:27017
DB_NAME=goigem
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
```

Generate a strong `JWT_SECRET`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## 5. Build The Web Frontend

Install Node.js 22 and Yarn:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
```

Build the same-origin web app:

```bash
cd ~/goigemshiftcheck/frontend
yarn install --frozen-lockfile
EXPO_NO_DOTENV=1 EXPO_PUBLIC_BACKEND_URL= npx expo export --platform web
```

Same-origin means the browser calls `/api` on the same domain that serves the web app.

## 6. Start The Stack

```bash
cd ~/goigemshiftcheck/deployment
docker compose up -d --build
```

Check status:

```bash
docker compose ps
curl http://127.0.0.1/api/
```

Expected response:

```json
{"message":"Shift Management API"}
```

Open:

```text
http://YOUR_DOMAIN_OR_ELASTIC_IP
```

## 7. Add HTTPS

The included Compose stack publishes HTTP on port `80`. For production, terminate TLS with one of these options:

- AWS Application Load Balancer with an ACM certificate
- Cloudflare proxy with Full/Strict TLS
- Caddy or host-level Nginx with Let's Encrypt

The lowest-maintenance option is usually Cloudflare:

1. Point the domain to the EC2 Elastic IP.
2. Enable the Cloudflare proxy.
3. Set SSL/TLS mode to Full.
4. Keep ports `80` and `443` open in the AWS security group.

If you use AWS ALB, place the EC2 instance in a target group on port `80`, attach an ACM certificate to the ALB listener on port `443`, and point DNS to the ALB.

## 8. Deploy Updates

For each release:

```bash
cd ~/goigemshiftcheck
git pull

cd frontend
yarn install --frozen-lockfile
EXPO_NO_DOTENV=1 EXPO_PUBLIC_BACKEND_URL= npx expo export --platform web

cd ../deployment
docker compose up -d --build
docker compose ps
curl http://127.0.0.1/api/
```

## 9. Backups

The MongoDB data lives in the Docker volume `deployment_mongo_data`. Create an archive backup:

```bash
docker run --rm -v deployment_mongo_data:/data/db -v "$PWD":/backup alpine tar czf /backup/mongo_data_backup.tgz -C /data/db .
```

Copy the backup off the EC2 instance:

```bash
scp -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP:~/goigemshiftcheck/deployment/mongo_data_backup.tgz .
```

For production, automate backups to S3 or use MongoDB Atlas.

## 10. Troubleshooting

View logs:

```bash
cd ~/goigemshiftcheck/deployment
docker compose logs -f backend
docker compose logs -f web
docker compose logs -f mongo
```

Common checks:

- `curl http://127.0.0.1/api/` should return the API message.
- `frontend/dist` must exist before starting the `web` container.
- Security Group must allow inbound `80` and `443`.
- `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` should be set in `deployment/.env`.
- MongoDB should only be reachable inside Docker, not from the public internet.
