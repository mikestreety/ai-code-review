# Claude Code Development Workflow

## Project Configuration for Feature Development

This document establishes the mandatory workflow for all feature requests and improvements to the GitLab MR Reviewer project.

## Required Workflow for Every Feature Request

### 1. Branch Creation
- **MUST** create a new feature branch for each request
- Branch naming convention: `feature/[descriptive-name]`
- Example: `feature/add-config-file-support`, `feature/improve-error-handling`

### 2. Implementation Process
- Implement the requested feature or improvement
- Follow existing code patterns and conventions
- Maintain backward compatibility unless explicitly requested otherwise
- Update documentation (README.md) when adding new functionality

### 3. Self-Testing Requirement
- **MANDATORY**: Test the implemented feature using the tool itself
- Run the GitLab MR Reviewer on its own codebase with the new changes
- Command to use: `node ./bin/run.js review -m local -l [claude|gemini] -o [html|cli] -b main`
- Generate both HTML and CLI outputs to verify functionality

### 4. Feedback Analysis & Implementation
- Analyze all feedback from the self-review
- Implement **ALL** blocking issues and critical suggestions
- Address performance, security, and maintainability concerns
- Fix any bugs or issues identified during self-testing

### 5. Quality Assurance
- Ensure all existing functionality still works
- Test interactive mode with inquirer prompts
- Verify spinners and loading animations function correctly
- Run linting if available: `npm run lint`

### 6. Documentation Updates
- Update README.md for new features or changed behavior
- Add usage examples for new functionality
- Update help text and command descriptions as needed

### 7. Final Commit & Push
- Create comprehensive commit message following existing patterns
- Include co-authorship: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Push to remote repository
- Ready for merge to main

## Testing Commands for Self-Review

### Local Review (Required)
```bash
# HTML output test
node ./bin/run.js review -m local -l claude -o html -b main

# CLI output test  
node ./bin/run.js review -m local -l gemini -o cli -b main
```

### Interactive Mode Test
```bash
# Test prompts and user interaction
node ./bin/run.js
```

### Command Verification
```bash
# Test all commands work
node ./bin/run.js --help
node ./bin/run.js review --help
node ./bin/run.js list-llms
node ./bin/run.js setup
```

## Compliance Requirements

### For Every Feature Request, Claude Must:
1. ✅ Create a dedicated feature branch
2. ✅ Implement the requested functionality  
3. ✅ Test using the tool on its own codebase
4. ✅ Analyze and implement ALL self-review feedback
5. ✅ Verify no regressions in existing functionality
6. ✅ Update documentation appropriately
7. ✅ Provide comprehensive commit message
8. ✅ Push branch and prepare for main merge

### Success Criteria
- All self-review feedback implemented
- No blocking issues remaining
- All existing tests/functionality preserved
- Documentation updated
- Clean, professional commit history

## Example Self-Testing Output
When testing is successful, you should see output like:
```
🔍 Comparing feature/new-feature (abc123) with main (def456)
✔ Found X changed files, diff size: Y characters
✔ File context prepared, total size: Z characters  
✔ CLAUDE code review completed in N.Ns
```

## Enforcement
This workflow is **MANDATORY** for all feature development. Any deviation from this process should be flagged and corrected before proceeding.

---

**Note**: This configuration ensures high code quality, thorough testing, and consistent development practices for the GitLab MR Reviewer project.