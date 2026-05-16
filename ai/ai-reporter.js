const fs = require('fs');

function generateBugReport(testName, errorMessage, severity) {

  const timestamp = new Date().toLocaleString();

  const report = `
================================
        AI BUG REPORT
================================

Generated:
${timestamp}

Test Name:
${testName}

Issue:
${errorMessage}

Severity:
${severity}

AI Analysis:
Possible UI mismatch, selector failure,
or unexpected application behavior detected.

Suggested Fix:
1. Verify selectors
2. Check UI rendering
3. Validate expected text
4. Review recent frontend changes

================================
`;

  // Create unique filename
  const filename = `reports/bug-report-${Date.now()}.txt`;

  fs.writeFileSync(filename, report);

  console.log(`AI bug report generated: ${filename}`);
}

// Example
generateBugReport(
  'Failure Detection Demo',
  'Expected title did not match actual title',
  'High'
);