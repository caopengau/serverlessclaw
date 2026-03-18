#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

STAGE=$1
EXPECTED_ACCOUNT=$2

if [[ -z "$STAGE" || -z "$EXPECTED_ACCOUNT" ]]; then
    echo -e "${RED}❌ Usage: $0 <stage> <expected_account>${NC}"
    exit 1
fi

# Only check for dev and production
if [[ "$STAGE" != "dev" && "$STAGE" != "prod" && "$STAGE" != "production" ]]; then
    exit 0
fi

CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

if [[ "$CURRENT_ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
    echo -e "${RED}❌ Deployment blocked: Stage \"$STAGE\" MUST be deployed to the configured AWS account ($EXPECTED_ACCOUNT). Current account is $CURRENT_ACCOUNT.${NC}"
    exit 1
fi

echo "✅ AWS Account validation passed for stage \"$STAGE\"."
