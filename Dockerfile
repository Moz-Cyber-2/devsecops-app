# INTENTIONALLY INSECURE — for DevSecOps demo
# Findings expected:
#   - Trivy: CVE in lodash, axios, node-fetch, serialize-javascript
#   - Trivy: running as root (no USER directive)
#   - Trivy: node:18 base has known CVEs
#   - Kyverno: will BLOCK this pod in enforce mode (runAsNonRoot policy)

FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY ./src ./src

EXPOSE 3000

# No USER directive — runs as root
CMD ["node", "src/index.js"]
