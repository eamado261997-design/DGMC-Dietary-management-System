# Remove Test Files from Repository

## Quick Steps to Clean Your GitHub Repository

### Option 1: Using the Automated Script (Recommended)

```bash
# 1. Clone your repository
git clone https://github.com/eamado261997-design/DGMC-Dietary-management-System.git
cd DGMC-Dietary-management-System

# 2. Make script executable
chmod +x remove-testfiles.sh

# 3. Run the script
./remove-testfiles.sh

# Follow the prompts to remove test files and push to GitHub
```

### Option 2: Manual Steps

```bash
# 1. Clone repository
git clone https://github.com/eamado261997-design/DGMC-Dietary-management-System.git
cd DGMC-Dietary-management-System

# 2. Remove test directories
rm -rf src/tests/
rm -rf src/server/tests/
rm -rf __tests__/
rm -rf tests/

# 3. Remove test files
find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) -delete

# 4. Remove test configuration
rm -f jest.config.js vitest.config.ts karma.conf.js

# 5. Update .gitignore (copy the provided .gitignore file)
# This prevents future test files from being committed

# 6. Stage all changes
git add -A

# 7. Verify what will be removed
git status

# 8. Commit changes
git commit -m "Remove test files from repository

- Deleted __tests__ directory
- Removed .test.ts and .spec.ts files
- Removed test configuration files
- Updated .gitignore to prevent test files
- Repository now contains only production code"

# 9. Push to GitHub
git push origin main
# Or if using different branch:
git push origin <your-branch-name>
```

### Option 3: Remove from GitHub WITHOUT Local Cleanup (Using Git Filter)

**WARNING: This rewrites repository history. Use only if needed.**

```bash
# Only remove from GitHub history (keeps local files)
git filter-branch --tree-filter 'find . -name "*.test.ts" -o -name "*.spec.ts" | xargs rm -f' -f

# Force push to remote
git push origin main --force
```

---

## Files to Remove

### Test Directories
```
src/tests/
src/server/tests/
__tests__/
tests/
test/
```

### Test Files (Patterns)
```
*.test.ts
*.test.tsx
*.test.js
*.test.jsx
*.spec.ts
*.spec.tsx
*.spec.js
*.spec.jsx
```

### Test Configuration Files
```
jest.config.js
jest.config.ts
vitest.config.ts
vitest.config.js
karma.conf.js
*.test.config.js
```

### Test Coverage Files
```
coverage/
.coverage
*.lcov
```

---

## After Cleanup

### Update .gitignore

Use the provided `.gitignore` file to prevent test files from being committed in the future.

### Verify Changes

```bash
# Check what's being tracked
git ls-tree -r HEAD | grep -E "test|spec"

# Should return: (nothing or minimal test-related files)

# Check repository size reduction
du -sh .git
```

### Create Pull Request (Optional)

If you want others to review before merging:

```bash
# Create a new branch
git checkout -b cleanup/remove-testfiles

# Make changes (as above)
# Commit and push

# Then create PR on GitHub
git push origin cleanup/remove-testfiles
```

Then on GitHub:
1. Go to your repository
2. Click "Pull Requests"
3. Click "New Pull Request"
4. Select your branch
5. Add title: "Remove test files from repository"
6. Add description with the commit message
7. Create Pull Request
8. Merge when ready

---

## Verify Deletion

After pushing, verify on GitHub:

```bash
# Check recent commits include test file removal
git log --oneline -5

# Output should show: "Remove test files from repository"

# Verify remote repository
git ls-remote --heads origin
```

---

## GitHub Web UI Verification

1. Go to https://github.com/eamado261997-design/DGMC-Dietary-management-System
2. Browse to `src/` directory
3. Verify no `tests/` or `__tests__/` directories exist
4. Check recent commits show cleanup

---

## Troubleshooting

### "Permission denied" on script

```bash
chmod +x remove-testfiles.sh
./remove-testfiles.sh
```

### "Nothing to commit"

Test files may already be removed or git not recognizing changes:

```bash
git status

# If nothing shows:
git add -A
git status
```

### "Rejected (non-fast-forward update)"

Someone else pushed while you were working:

```bash
git pull origin main
git push origin main
```

### Accidentally Deleted Important Files

```bash
# Restore from last commit
git checkout HEAD -- .

# Or restore specific file
git checkout HEAD -- path/to/file
```

---

## Next Steps

After removing test files:

1. ✅ Verify changes on GitHub
2. ✅ Update any CI/CD pipelines that reference test files
3. ✅ Update documentation if it mentions tests
4. ✅ Inform team members to pull latest changes
5. ✅ Consider keeping tests locally during development (just don't commit)

---

## Benefits of Cleanup

- ✅ Smaller repository size
- ✅ Faster clones for new developers
- ✅ Cleaner file tree
- ✅ Focus on production code
- ✅ Easier maintenance
- ✅ Better organization

---

**Recommendation:** Use the provided `.gitignore` to prevent test files from being committed in the future.
