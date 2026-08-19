#!/usr/bin/env bash
# scripts/setup-local-infra.sh
# Sets up the local kind cluster with Kyverno for the DevSecOps demo.
# Run this ONCE before registering the self-hosted runner.
#
# Prerequisites: docker, kind, kubectl, helm

set -euo pipefail

CLUSTER_NAME="devsecops-demo"
KYVERNO_VERSION="3.2.6"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         DevSecOps Demo — Local Infrastructure Setup         ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── 1. Kind cluster ───────────────────────────────────────────────────
echo ""
echo "▶ Step 1: Create kind cluster '${CLUSTER_NAME}'"

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "  Cluster '${CLUSTER_NAME}' already exists — skipping."
else
  cat <<EOF | kind create cluster --name "${CLUSTER_NAME}" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      # Expose the demo app NodePort to the host
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
EOF
  echo "  Cluster created."
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}"

# ── 2. Kyverno ───────────────────────────────────────────────────────
echo ""
echo "▶ Step 2: Install Kyverno ${KYVERNO_VERSION} (enforce mode)"

helm repo add kyverno https://kyverno.github.io/kyverno/ --force-update
helm repo update

if helm status kyverno -n kyverno &>/dev/null; then
  echo "  Kyverno already installed — upgrading."
  helm upgrade kyverno kyverno/kyverno \
    --namespace kyverno \
    --version "${KYVERNO_VERSION}" \
    --set admissionController.replicas=1 \
    --wait
else
  helm install kyverno kyverno/kyverno \
    --namespace kyverno \
    --create-namespace \
    --version "${KYVERNO_VERSION}" \
    --set admissionController.replicas=1 \
    --wait
  echo "  Kyverno installed."
fi

# ── 3. Kyverno policies ───────────────────────────────────────────────
echo ""
echo "▶ Step 3: Apply Kyverno enforce policies"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICIES_DIR="${SCRIPT_DIR}/../kyverno-policies"

kubectl apply -f "${POLICIES_DIR}/"
echo ""
kubectl get clusterpolicy -o wide

# ── 4. namespace ─────────────────────────────────────────────────────
echo ""
echo "▶ Step 4: Create app namespace"
kubectl apply -f "${SCRIPT_DIR}/../manifests/base/namespace.yaml"

# ── 5. Self-hosted runner instructions ───────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Next: Register Self-Hosted Runner              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  1. Go to your app repo on GitHub                           ║"
echo "║     Settings → Actions → Runners → New self-hosted runner   ║"
echo "║                                                              ║"
echo "║  2. Download and configure the runner:                      ║"
echo "║     mkdir actions-runner && cd actions-runner               ║"
echo "║     curl -sL <runner-download-url> | tar xz                 ║"
echo "║     ./config.sh --url <repo-url> --token <token>            ║"
echo "║                                                              ║"
echo "║  3. Add the label 'devsecops-demo':                         ║"
echo "║     ./config.sh ... --labels devsecops-demo                 ║"
echo "║                                                              ║"
echo "║  4. Start the runner:                                        ║"
echo "║     ./run.sh                                                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"

echo ""
echo "Setup complete. Cluster '${CLUSTER_NAME}' is ready."
