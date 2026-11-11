#!/usr/bin/env bash
# Starts the UNCHANGED Kredent backend against the local benchmark stack only:
#   local PostgreSQL (127.0.0.1:54329)  - benchmarks/local-db
#   mock Supabase Storage (127.0.0.1:54321) - benchmarks/mock-storage
#   local Hardhat chain (127.0.0.1:8545) + locally deployed contract - benchmarks/.local-chain.json
#
# Every Kredent setting is set explicitly here, and any value already in your shell or IntelliJ
# environment is cleared first, so your real Supabase database, storage bucket, Resend email key
# and Amoy RPC can never be picked up. No properties file is edited: overrides are passed as
# environment variables and one launch argument (--spring.jpa.show-sql=false).
#
# Run from the repository root:  bash benchmarks/scripts/start-backend-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHAIN_FILE="$ROOT/benchmarks/.local-chain.json"
[ -f "$CHAIN_FILE" ] || { echo "Missing $CHAIN_FILE - deploy the local contract first (see benchmarks/README.md)."; exit 1; }

read_json() { node -e "console.log(require(process.argv[1])[process.argv[2]])" "$CHAIN_FILE" "$1"; }
CONTRACT="$(read_json contractAddress)"
ISSUER="$(read_json issuer)"
CHAIN_ID="$(read_json chainId)"
[ "$CHAIN_ID" = "31337" ] || { echo "Refusing: .local-chain.json is not for the local Hardhat chain."; exit 1; }

# Clear anything inherited (including Spring's relaxed-binding names that would override properties).
unset DB_URL DB_USERNAME DB_PASSWORD JWT_SECRET JWT_EXPIRATION_MS ADMIN_EMAIL ADMIN_FULL_NAME \
      ADMIN_WALLET_ADDRESS SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_STORAGE_BUCKET \
      CERTIFICATE_MAX_FILE_SIZE_MB FRONTEND_BASE_URL EMAIL_API_KEY EMAIL_FROM CORS_ALLOWED_ORIGINS \
      BLOCKCHAIN_RPC_URL BLOCKCHAIN_NETWORK SMART_CONTRACT_ADDRESS BLOCKCHAIN_ADMIN_WALLET_ADDRESS \
      WALLET_ENCRYPTION_SECRET SPRING_PROFILES_ACTIVE SPRING_DATASOURCE_URL SPRING_DATASOURCE_USERNAME \
      SPRING_DATASOURCE_PASSWORD SPRING_APPLICATION_JSON
# Also clear anything that could inject an external config file or JVM -D overrides.
unset SPRING_CONFIG_LOCATION SPRING_CONFIG_ADDITIONAL_LOCATION SPRING_CONFIG_IMPORT SPRING_CONFIG_NAME \
      JAVA_TOOL_OPTIONS _JAVA_OPTIONS JDK_JAVA_OPTIONS MAVEN_OPTS

export DB_URL="jdbc:postgresql://127.0.0.1:54329/kredent_bench"
export DB_USERNAME="postgres"
export DB_PASSWORD="local-bench"                       # local trust auth; value is not checked
export SUPABASE_URL="http://127.0.0.1:54321"           # mock storage, not Supabase
export SUPABASE_SERVICE_ROLE_KEY="local-mock-storage-dummy-value"
export SUPABASE_STORAGE_BUCKET="certificates-bench"
export BLOCKCHAIN_RPC_URL="http://127.0.0.1:8545"      # local Hardhat node, not Amoy
export BLOCKCHAIN_NETWORK="hardhat-local"
export SMART_CONTRACT_ADDRESS="$CONTRACT"
export ADMIN_WALLET_ADDRESS="$ISSUER"                  # Hardhat public test account #0
export BLOCKCHAIN_ADMIN_WALLET_ADDRESS="$ISSUER"
export ADMIN_EMAIL="bench-admin@kredent.local"
export FRONTEND_BASE_URL="http://localhost:5173"
export EMAIL_API_KEY=""                                # email disabled: no real mail is sent
# Throwaway random secrets for this local process only (generated fresh, never printed or saved).
export JWT_SECRET="$(openssl rand -hex 32)"
export WALLET_ENCRYPTION_SECRET="$(openssl rand -hex 32)"

# Use JDK 17 (the project's target) if macOS can find one; otherwise keep the current JAVA_HOME.
if [ -x /usr/libexec/java_home ] && /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi
echo "[bench] JDK: $("${JAVA_HOME:+$JAVA_HOME/bin/}java" -version 2>&1 | head -1)"
echo "[bench] contract $CONTRACT on local chain 31337; DB 127.0.0.1:54329/kredent_bench; storage mock :54321"

cd "$ROOT/backend"
exec mvn -q spring-boot:run -Dspring-boot.run.arguments="--spring.jpa.show-sql=false"
