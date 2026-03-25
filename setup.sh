#!/bin/bash
# Astra AI Agent Framework - Quick Setup Script
# Run with: chmod +x setup.sh && ./setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "    _    ____ _____ ____      _    "
echo "   / \  / ___|_   _|  _ \    / \   "
echo "  / _ \ \___ \ | | | |_) |  / _ \  "
echo " / ___ \ ___) || | |  _ <  / ___ \ "
echo "/_/   \_\____/ |_| |_| \_\/_/   \_\\"
echo ""
echo "AI Agent Framework - Quick Setup"
echo -e "${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        echo "Please install $1 and try again"
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} $1 found"
}

check_command node
check_command npm

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js v$NODE_VERSION"

# Optional checks
if command -v docker &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} Docker found (recommended for full features)"
else
    echo -e "${YELLOW}[WARN]${NC} Docker not found (optional, needed for sandboxing)"
fi

if command -v python3 &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} Python3 found (needed for Neural Engine)"
else
    echo -e "${YELLOW}[WARN]${NC} Python3 not found (optional, needed for Neural Engine)"
fi

echo ""

# Step 1: Install Node dependencies
echo -e "${BLUE}[1/4]${NC} Installing Node.js dependencies..."
npm install

# Step 2: Build TypeScript
echo -e "${BLUE}[2/4]${NC} Building TypeScript..."
npm run build

# Step 3: Setup environment file
echo -e "${BLUE}[3/4]${NC} Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env

    # Generate secure random keys
    if command -v openssl &> /dev/null; then
        MASTER_KEY=$(openssl rand -hex 32)
        JWT_SECRET=$(openssl rand -hex 32)
        JWT_REFRESH=$(openssl rand -hex 32)
        SYSTEM_SECRET=$(openssl rand -hex 32)

        # Replace placeholder values in .env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/your-32-character-minimum-encryption-key-here/$MASTER_KEY/" .env
            sed -i '' "s/your-32-character-minimum-jwt-secret-here/$JWT_SECRET/" .env
            sed -i '' "s/your-32-character-minimum-refresh-secret-here/$JWT_REFRESH/" .env
            sed -i '' "s/your-32-character-minimum-system-secret-here/$SYSTEM_SECRET/" .env
        else
            # Linux
            sed -i "s/your-32-character-minimum-encryption-key-here/$MASTER_KEY/" .env
            sed -i "s/your-32-character-minimum-jwt-secret-here/$JWT_SECRET/" .env
            sed -i "s/your-32-character-minimum-refresh-secret-here/$JWT_REFRESH/" .env
            sed -i "s/your-32-character-minimum-system-secret-here/$SYSTEM_SECRET/" .env
        fi

        echo -e "${GREEN}[OK]${NC} Generated secure encryption keys"
    else
        echo -e "${YELLOW}[WARN]${NC} OpenSSL not found - please manually set encryption keys in .env"
    fi
else
    echo -e "${YELLOW}[SKIP]${NC} .env already exists"
fi

# Step 4: Create data directories
echo -e "${BLUE}[4/4]${NC} Creating data directories..."
mkdir -p workspaces astra_memory knowledge_base screenshots

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo ""
echo -e "  ${BLUE}1. Configure your .env file:${NC}"
echo "     - Add your LLM API keys (OpenAI/Anthropic/Google)"
echo "     - Configure OAuth providers (optional)"
echo "     - Set up messaging platforms (optional)"
echo ""
echo -e "  ${BLUE}2. Start the API server:${NC}"
echo "     npm run start:api"
echo ""
echo -e "  ${BLUE}3. Or use Docker (recommended):${NC}"
echo "     docker-compose up -d"
echo ""
echo -e "  ${BLUE}4. Access the API:${NC}"
echo "     http://localhost:3000"
echo ""
echo -e "Documentation: ${YELLOW}https://github.com/your-repo/astra${NC}"
echo ""
