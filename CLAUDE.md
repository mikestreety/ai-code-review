# Claude Code Development Workflow

## Project Configuration for Feature Development

This document establishes the mandatory workflow for all feature requests and improvements to the Ruck project.

## Required Workflow for Every Feature Request

### 1. Branch Creation
- **MUST** create a new feature branch for each request
- Branch naming convention: `feature/[descriptive-name]`
- Example: `feature/add-config-file-support`, `feature/improve-error-handling`

### 2. Application Understanding & Documentation
- **MANDATORY**: Build and maintain understanding of the application architecture
- When working on any file for the first time, generate a lightweight summary of:
  - What the file does (primary purpose and functionality)
  - Key exports/functions/classes it provides
  - How it fits into the overall application architecture
  - Dependencies and relationships to other files
- Store these summaries as comments at the beginning of this workflow for future reference
- Use this knowledge base to efficiently locate functionality when needed
- Update summaries when making significant changes to existing files

### 3. Implementation Process
- Implement the requested feature or improvement
- Follow existing code patterns and conventions
- Maintain backward compatibility unless explicitly requested otherwise
- Update documentation (README.md) when adding new functionality

### 4. Self-Testing Requirement
- **MANDATORY**: Test the implemented feature using the tool itself
- Run Ruck on its own codebase with the new changes
- Command to use: `ruck review -m local -l [claude|gemini] -o [html|cli] -b main`
- Generate both HTML and CLI outputs to verify functionality

### 5. Feedback Analysis & Implementation
- Analyze all feedback from the self-review
- Implement **ALL** blocking issues and critical suggestions
- Address performance, security, and maintainability concerns
- Fix any bugs or issues identified during self-testing

### 6. Quality Assurance
- Ensure all existing functionality still works
- Test interactive mode with inquirer prompts
- Verify spinners and loading animations function correctly
- Run linting if available: `npm run lint`

### 7. Documentation Updates
- Update README.md for new features or changed behavior
- Add usage examples for new functionality
- Update help text and command descriptions as needed

### 8. Quality Assurance & Pre-Commit Checks
- **MANDATORY**: Run `npm run lint` to fix code style issues
- **MANDATORY**: Run `npm test` to ensure all tests pass (53+ tests)
- **MANDATORY**: Run `npm run test:coverage` to verify coverage reports
- Ensure no regressions in existing functionality
- Verify all new code is properly tested

### 9. Final Commit & Push
- Create comprehensive commit message following existing patterns
- Include co-authorship: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Push to remote repository
- Ready for merge to main

## Testing Commands for Self-Review

### Pre-Commit Quality Checks (MANDATORY)
```bash
# Fix linting issues
npm run lint

# Run all tests (must pass)
npm test

# Generate coverage reports
npm run test:coverage
```

### Local Review (Required)
```bash
# HTML output test
ruck review -m local -l claude -o html -b main

# CLI output test  
ruck review -m local -l gemini -o cli -b main
```

### Interactive Mode Test
```bash
# Test prompts and user interaction
ruck
```

### Command Verification
```bash
# Test all commands work
ruck --help
ruck review --help
ruck list-llms
ruck setup
```

## Compliance Requirements

### For Every Feature Request, Claude Must:
1. ✅ Create a dedicated feature branch
2. ✅ Build understanding of relevant application files and architecture
3. ✅ Implement the requested functionality  
4. ✅ Test using the tool on its own codebase
5. ✅ Analyze and implement ALL self-review feedback
6. ✅ Verify no regressions in existing functionality
7. ✅ Update documentation appropriately
8. ✅ Run `npm run lint` to fix code style issues
9. ✅ Run `npm test` to ensure all 53+ tests pass
10. ✅ Run `npm run test:coverage` to verify coverage
11. ✅ Provide comprehensive commit message
12. ✅ Push branch and prepare for main merge

### Success Criteria
- All self-review feedback implemented
- No blocking issues remaining
- All existing tests/functionality preserved (53+ tests passing)
- Linting issues resolved (`npm run lint` passes)
- Test coverage maintained or improved
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

## Application Knowledge Base

### File Summaries
<!-- Add lightweight summaries of files as you work on them -->
<!-- Format: **file/path**: Purpose - Key exports/functions - Architecture role - Dependencies -->

---

**Note**: This configuration ensures high code quality, thorough testing, consistent development practices, and comprehensive application understanding for the Ruck project.