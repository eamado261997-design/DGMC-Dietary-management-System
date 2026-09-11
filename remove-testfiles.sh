#!/bin/bash
# Script to remove test files from DGMC project

echo "=== Removing Test Files from DGMC Project ==="
echo ""

# Find and list test files
echo "Step 1: Finding test files..."
find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" -o -name "*test*" -path "*/test/*" \) ! -path "./node_modules/*" ! -path "./.git/*" 2>/dev/null

echo ""
echo "Step 2: Remove test files?"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Remove test directories
  rm -rf src/tests/
  rm -rf src/server/tests/
  rm -rf __tests__/
  rm -rf tests/
  
  # Remove test files
  find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) ! -path "./node_modules/*" ! -path "./.git/*" -delete
  
  # Remove test configuration files (optional)
  rm -f jest.config.js
  rm -f vitest.config.ts
  rm -f karma.conf.js
  
  echo "✓ Test files removed"
fi

echo ""
echo "Step 3: Stage changes for commit..."
git add -A
git status

echo ""
echo "Step 4: Commit changes..."
git commit -m "Remove test files from repository"

echo ""
echo "Step 5: Push to repository..."
read -p "Push to remote? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main
  echo "✓ Changes pushed to GitHub"
fi

echo ""
echo "=== Complete ==="
