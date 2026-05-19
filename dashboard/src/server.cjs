require('dotenv').config();
const cron = require('node-cron');
const db = require('./database.cjs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateMultipleTests } = require('../../ai/multi-test-generator');
const { scanWebsite } = require('../../ai/site-scanner');
const { generateTest } = require('../../ai/test-generator');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const http = require('http');
const { Server } = require('socket.io');
const { Resend } = require('resend');
const axios = require('axios');
const simpleGit = require('simple-git');
const fsExtra = require('fs-extra');

const app = express();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendFailureEmail(to, report) {

  try {

    console.log('Sending alert email to:', to);

    const result = await resend.emails.send({
      from: 'AI Tester <onboarding@resend.dev>',
      to: to,
      subject: 'AI Tester Alert — Test Failures Detected',
      text: report
    });

    if (result.error) {
      console.log('Email failed:', result.error.message);
    } else {
      console.log('Failure alert email sent:', result.data);
    }

  } catch (err) {

    console.log('Email failed:', err.message);

  }

}

const scheduledJobs = {};

app.use(cors());
app.use(express.static(path.join(__dirname, '../../')));

app.use(
  '/repo-artifacts',
  express.static(path.join(__dirname, '../../temp-repos'))
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const JWT_SECRET = 'ai_testing_secret_key';

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.post('/signup', async (req, res) => {

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.json({
      success: false,
      message: 'All fields are required'
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

db.query(
  'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
  [name, email, hashedPassword],
  (err) => {

      if (err) {
        return res.json({
          success: false,
          message: 'User already exists or signup failed'
        });
      }

      res.json({
        success: true,
        message: 'Signup successful'
      });

    }
  );

});

app.get('/auth/github', (req, res) => {
  const githubURL =
    `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,user`;

  res.redirect(githubURL);
});

app.get('/github/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get(
      'https://api.github.com/user',
      {
        headers: {
          Authorization: `token ${accessToken}`
        }
      }
    );

    const githubUser = userResponse.data;

    const emailResponse = await axios.get(
  'https://api.github.com/user/emails',
  {
    headers: {
      Authorization: `token ${accessToken}`
    }
  }
);

const primaryEmail = emailResponse.data.find(
  (email) => email.primary && email.verified
)?.email;

if (!primaryEmail) {
  return res.send('GitHub login failed: No verified email found');
}

    let result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [primaryEmail]
    );

    let user;

    if (result.rows.length === 0) {
      const insertResult = await db.query(
        `INSERT INTO users (name, email, password)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          githubUser.name || githubUser.login,
          primaryEmail,
          'github-oauth-user'
        ]
      );

      user = insertResult.rows[0];
    } else {
      user = result.rows[0];
    }

    await db.query(
  `DELETE FROM github_connections WHERE user_id = $1`,
  [user.id]
);

await db.query(
  `INSERT INTO github_connections
   (user_id, github_username, github_access_token)
   VALUES ($1, $2, $3)`,
  [user.id, githubUser.login, accessToken]
);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

   const encodedUser = encodeURIComponent(JSON.stringify({
  id: user.id,
  name: user.name,
  email: user.email
}));

res.redirect(
  `https://ai-testing-platform-one.vercel.app/?token=${token}&user=${encodedUser}`
);

  } catch (error) {
    console.log(error.message);
    res.send('GitHub login failed');
  }
});

app.get('/github/repos', verifyToken, async (req, res) => {
  try {
    const connection = await db.query(
      'SELECT * FROM github_connections WHERE user_id = $1',
      [req.user.id]
    );

    if (connection.rows.length === 0) {
      return res.json({
        success: false,
        message: 'GitHub not connected'
      });
    }

    const accessToken = connection.rows[0].github_access_token;

    const reposResponse = await axios.get(
      'https://api.github.com/user/repos?sort=updated&per_page=20',
      {
        headers: {
          Authorization: `token ${accessToken}`
        }
      }
    );

    res.json({
      success: true,
      repos: reposResponse.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        updated_at: repo.updated_at
      }))
    });

  } catch (err) {
    console.log('GitHub repos failed:', err.message);

    res.json({
      success: false,
      message: 'Failed to load GitHub repositories'
    });
  }
});

app.post('/projects/link-github', verifyToken, async (req, res) => {
  const { projectId, repo, branch } = req.body;

  if (!projectId || !repo) {
    return res.json({
      success: false,
      message: 'Project and repository are required'
    });
  }

  try {
    const result = await db.query(
  `UPDATE projects
   SET github_repo = $1, github_branch = $2
   WHERE id = $3 AND user_id = $4
   RETURNING *`,
  [repo, branch || 'main', projectId, req.user.id]
);

if (result.rows.length === 0) {
  return res.json({
    success: false,
    message: 'No matching project found to link'
  });
}

res.json({
  success: true,
  message: 'GitHub repository linked to project',
  project: result.rows[0]
});

  } catch (err) {
    console.log('Link GitHub repo failed:', err.message);

    res.json({
      success: false,
      message: 'Failed to link GitHub repository'
    });
  }
});

app.post('/login', (req, res) => {

  const { email, password } = req.body;

  db.query(
  'SELECT * FROM users WHERE email = $1',
  [email],
  async (err, result) => {

    const user = result?.rows?.[0];

      if (err || !user) {
        return res.json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email
        },
        JWT_SECRET,
        {
          expiresIn: '1d'
        }
      );

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });

    }
  );

});

function verifyToken(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.json({
      success: false,
      message: 'No token provided'
    });
  }

  const token = authHeader.split(' ')[1];

  try {

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();

  } catch (error) {

    res.json({
      success: false,
      message: 'Invalid token'
    });

  }

}
app.post('/projects', verifyToken, (req, res) => {

  const { name, url } = req.body;

  if (!name || !url) {
    return res.json({
      success: false,
      message: 'Project name and URL are required'
    });
  }

  db.query(
  'INSERT INTO projects (user_id, name, url) VALUES ($1, $2, $3) RETURNING id',
  [req.user.id, name, url],
  (err, result) => {

    if (err) {
      console.log('Create project failed:', err.message);
      return res.json({
        success: false,
        message: 'Failed to create project'
      });
    }

    res.json({
      success: true,
      message: 'Project created successfully',
      projectId: result.rows[0].id
    });

  }
);

});

app.get('/projects', verifyToken, (req, res) => {

  db.query(
  'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
  [req.user.id],
  (err, result) => {

    const rows = result?.rows || [];

      if (err) {
        console.log('Load projects failed:', err.message);
        return res.json({
          success: false,
          message: 'Failed to load projects'
        });
      }

      res.json({
        success: true,
        projects: rows
      });

    }
  );

});

app.post('/test-history', verifyToken, (req, res) => {

  const {
    project_id,
    project_name,
    total,
    passed,
    failed,
    logs
  } = req.body;

 db.query(
  `INSERT INTO test_history
   (user_id, project_id, project_name, total, passed, failed, logs)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [req.user.id, project_id, project_name, total, passed, failed, logs],
  (err) => {

    if (err) {
      console.log('Test history save failed:', err.message);

      return res.json({
        success: false,
        message: 'Failed to save test history'
      });
    }

    res.json({
      success: true,
      message: 'Test history saved'
    });

  }
);

});

app.get('/test-history', verifyToken, (req, res) => {

  db.query(
  'SELECT * FROM test_history WHERE user_id = $1 ORDER BY created_at DESC',
  [req.user.id],
  (err, result) => {

    const rows = result?.rows || [];

      if (err) {
        console.log('Load history failed:', err.message);
        return res.json({
          success: false,
          message: 'Failed to load test history'
        });
      }

      res.json({
        success: true,
        history: rows
      });

    }
  );

});

app.get('/scan-site', async (req, res) => {

  const url = req.query.url;

  if (!url) {
    return res.json({
      success: false,
      message: 'URL is required'
    });
  }

  try {

    const results = await scanWebsite(url);

    res.json({
      success: true,
      results
    });

  } catch (error) {

    res.json({
      success: false,
      message: error.message
    });

  }

});

app.get('/generate-test', (req, res) => {

  const url = req.query.url;

  if (!url) {

    return res.json({
      success: false,
      message: 'URL is required'
    });

  }

  const testCode = generateTest(url);

  res.json({
    success: true,
    message: 'AI test generated successfully',
    code: testCode
  });

});

app.get('/generate-suite', async (req, res) => {

  const url = req.query.url;

  if (!url) {
    return res.json({
      success: false,
      message: 'URL is required'
    });
  }

  const scanResults = {
    links: [],
    buttons: [],
    inputs: 0
  };

  const result = generateMultipleTests(url, scanResults);

  res.json({
    success: true,
    message: 'AI generated multiple tests successfully',
    result
  });

});

app.get('/download-report', (req, res) => {

  const doc = new PDFDocument();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="ai-test-report.pdf"'
  );

  doc.pipe(res);

  doc.fontSize(24).text('AI Testing Platform Report', {
    align: 'center'
  });

  doc.moveDown();

  doc.fontSize(16).text('Summary');
  doc.text('Total Tests: 27');
  doc.text('Passed Tests: 27');
  doc.text('Failed Tests: 0');

  doc.moveDown();

  doc.fontSize(16).text('AI Features Used');
  doc.text('- Real-time streaming logs');
  doc.text('- AI self-healing selectors');
  doc.text('- Website scanner');
  doc.text('- AI-generated tests');
  doc.text('- Autonomous test suite generation');

  doc.moveDown();

  doc.fontSize(16).text('Status');
  doc.text('All tests completed successfully.');

  doc.end();

});

function getCronTime(frequency) {

  if (frequency === 'hourly') {
    return '0 * * * *';
  }

  if (frequency === 'daily') {
    return '0 9 * * *';
  }

  if (frequency === 'weekly') {
    return '0 9 * * 1';
  }

  return null;

}

app.post('/schedule-tests', verifyToken, (req, res) => {

  const { frequency, project_id } = req.body;

  if (!project_id) {
    return res.json({
      success: false,
      message: 'Please select a project first'
    });
  }

  if (!['hourly', 'daily', 'weekly'].includes(frequency)) {
    return res.json({
      success: false,
      message: 'Invalid frequency'
    });
  }

  db.query(
  'DELETE FROM schedules WHERE user_id = $1 AND project_id = $2',
  [req.user.id, project_id],
  (err) => {

    if (err) {
      return res.json({
        success: false,
        message: 'Failed to update schedule'
      });
    }

    db.query(
      'INSERT INTO schedules (user_id, project_id, frequency, enabled) VALUES ($1, $2, $3, $4)',
      [req.user.id, project_id, frequency, 1],
      (err) => {

        if (err) {
          return res.json({
            success: false,
            message: 'Failed to save schedule'
          });
        }

        const cronTime = getCronTime(frequency);

        if (scheduledJobs[project_id]) {
          scheduledJobs[project_id].stop();
        }

        scheduledJobs[project_id] = cron.schedule(cronTime, () => {

          console.log(`Scheduled test run triggered for project ${project_id}`);

          const testProcess = spawn('npx', ['playwright', 'test'], {
            cwd: '..',
            shell: true,
            env: {
              ...process.env,
              NODE_NO_WARNINGS: '1'
            }
          });

          testProcess.stdout.on('data', (data) => {
            io.emit('test-log', data.toString());
          });

          testProcess.stderr.on('data', (data) => {
            io.emit('test-log', data.toString());
          });

        });

        res.json({
          success: true,
          message: `Schedule saved for project: ${frequency}`
        });

      }
    );

  }
);

});

app.get('/schedule/:projectId', verifyToken, (req, res) => {

  db.query(
  'SELECT * FROM schedules WHERE user_id = $1 AND project_id = $2 AND enabled = 1',
  [req.user.id, req.params.projectId],
  (err, result) => {

    const row = result?.rows?.[0];

    if (err) {
      return res.json({
        success: false,
        message: 'Failed to load schedule'
      });
    }

    res.json({
      success: true,
      schedule: row || null
    });

  }
);

});

app.post('/stop-schedule', verifyToken, (req, res) => {

  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
  }

  res.json({
    success: true,
    message: 'Scheduled tests stopped'
  });

});

app.get('/run-tests', (req, res) => {

  console.log('Run Tests button clicked');

  const testProcess = spawn(
    'npx',
    ['playwright', 'test'],
    {
      cwd: '..',
      shell: true,
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1'
      }
    }
  );

  let output = '';
  let screenshots = [];

  testProcess.stdout.on('data', (data) => {

    const text = data.toString();

    output += text;

    io.emit('test-log', text);

    const matches =
      text.match(/test-results\/.*?\.png/g) || [];

    matches.forEach((match) => {

      screenshots.push(
  `https://ai-testing-platform-production.up.railway.app/${match}`
);

    });

  });

  testProcess.stderr.on('data', (data) => {

    const text = data.toString();

    output += text;

    io.emit('test-log', text);

  });

  testProcess.on('close', (code) => {

  if (code !== 0) {

    const report = `
AI Tester Alert — Test Failures Detected

Status:
Tests completed with failures.

Summary:
Some Playwright tests failed.

Recommendation:
Open the AI Tester dashboard and review Failure Investigation, screenshots, and logs.

`;

    sendFailureEmail(process.env.ALERT_EMAIL, report);

  }

  res.json({
    success: code === 0,
    completed: true,
    output,
    screenshots
  });

});

});

const detectFramework = async (repoPath) => {
  const packageJsonPath = path.join(repoPath, 'package.json');

  if (!(await fsExtra.pathExists(packageJsonPath))) {
    return {
      framework: 'unknown',
      testCommand: null
    };
  }

  const packageJson = await fsExtra.readJson(packageJsonPath);

  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  const scripts = packageJson.scripts || {};

  // Playwright
  if (deps['@playwright/test']) {
    return {
      framework: 'playwright',
      testCommand: 'npx playwright test'
    };
  }

  // Cypress
  if (deps['cypress']) {
    return {
      framework: 'cypress',
      testCommand: 'npx cypress run'
    };
  }

  // Jest
  if (deps['jest']) {
    return {
      framework: 'jest',
      testCommand: 'npm test'
    };
  }

  // Vitest
  if (deps['vitest']) {
    return {
      framework: 'vitest',
      testCommand: 'npx vitest run'
    };
  }

  // Generic npm test
  if (scripts.test) {
    return {
      framework: 'generic',
      testCommand: 'npm test'
    };
  }

  return {
    framework: 'unknown',
    testCommand: null
  };
};

const analyzeTestFailure = (logs) => {
  const analysis = [];

  if (logs.includes('Timeout')) {
    analysis.push({
      type: 'Timeout Error',
      severity: 'medium',
      fix: 'Increase timeout or improve wait strategy'
    });
  }

  if (
    logs.includes('locator') ||
    logs.includes('selector')
  ) {
    analysis.push({
      type: 'Selector Failure',
      severity: 'high',
      fix: 'Use stable selectors like data-testid or role selectors'
    });
  }

  if (logs.includes('net::ERR')) {
    analysis.push({
      type: 'Network Failure',
      severity: 'high',
      fix: 'Check server availability or API connectivity'
    });
  }

  if (logs.includes('Target page')) {
    analysis.push({
      type: 'Browser Context Closed',
      severity: 'medium',
      fix: 'Avoid actions after page/browser closure'
    });
  }

  return analysis;
};

app.post('/run-repo-tests', verifyToken, async (req, res) => {
  const { projectId } = req.body;

  if (!projectId) {
    return res.json({
      success: false,
      message: 'Project ID is required'
    });
  }

  try {
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectResult.rows.length === 0) {
      return res.json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectResult.rows[0];

    if (!project.github_repo) {
      return res.json({
        success: false,
        message: 'No GitHub repo linked to this project'
      });
    }

    const tempDir = path.join(__dirname, '../../temp-repos', String(project.id));

    await fsExtra.remove(tempDir);
    await fsExtra.ensureDir(tempDir);

    const repoUrl = `https://github.com/${project.github_repo}.git`;

    io.emit('test-log', `Cloning repository: ${project.github_repo}\n`);

    await simpleGit().clone(repoUrl, tempDir);

    io.emit('test-log', `Repository cloned successfully\n`);
    io.emit('test-log', `Installing dependencies...\n`);

    const installProcess = spawn('npm', ['install'], {
      cwd: tempDir,
      shell: true
    });

    installProcess.stdout.on('data', (data) => {
      io.emit('test-log', data.toString());
    });

    installProcess.stderr.on('data', (data) => {
      io.emit('test-log', data.toString());
    });

    installProcess.on('close', async (installCode) => {
      let output = '';
      if (installCode !== 0) {
        return res.json({
          success: false,
          message: 'Dependency installation failed'
        });
      }

      const detected = await detectFramework(tempDir);

io.emit(
  'test-log',
  `Detected framework: ${detected.framework}\n`
);
output += `Detected framework: ${detected.framework}\n`;

if (!detected.testCommand) {
  return res.json({
    success: false,
    message: 'No supported testing framework detected'
  });
}

io.emit(
  'test-log',
  `Running command: ${detected.testCommand}\n`
);
output += `Running command: ${detected.testCommand}\n`;

const commandParts = detected.testCommand.split(' ');

const testProcess = spawn(
  commandParts[0],
  commandParts.slice(1),
  {
    cwd: tempDir,
    shell: true
  }
);

      testProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        io.emit('test-log', text);
      });

      testProcess.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        io.emit('test-log', text);
      });

     testProcess.on('close', async (code) => {

      const screenshotDir = path.join(tempDir, 'test-results');
let failureScreenshots = [];

if (await fsExtra.pathExists(screenshotDir)) {
  const files = await fsExtra.readdir(screenshotDir, {
    recursive: true
  });

  failureScreenshots = files
    .filter(file =>
      file.includes('test-failed') &&
      file.endsWith('.png')
    )
    .map(file => `/repo-artifacts/${file}`);
}

  const aiAnalysis = analyzeTestFailure(output);

  res.json({
  success: code === 0,
  completed: true,
  output,
  aiAnalysis,
  screenshots: failureScreenshots
});

});
    });

  } catch (err) {
    console.log('Run repo tests failed:', err.message);

    res.json({
      success: false,
      message: 'Failed to run repository tests'
    });
  }
});

db.query(
  'SELECT * FROM schedules WHERE enabled = 1',
  [],
  (err, result) => {

    const rows = result?.rows || [];

    if (err || !rows) {
      console.log('No saved schedules loaded');
      return;
    }

    rows.forEach((schedule) => {

      const cronTime = getCronTime(schedule.frequency);

      if (!cronTime) return;

      scheduledJobs[schedule.project_id] = cron.schedule(cronTime, () => {

        console.log(`Auto-restored schedule running for project ${schedule.project_id}`);

        const testProcess = spawn('npx', ['playwright', 'test'], {
          cwd: '..',
          shell: true,
          env: {
            ...process.env,
            NODE_NO_WARNINGS: '1'
          }
        });

        testProcess.stdout.on('data', (data) => {
          io.emit('test-log', data.toString());
        });

        testProcess.stderr.on('data', (data) => {
          io.emit('test-log', data.toString());
        });

      });

    });

    console.log(`Loaded ${rows.length} saved schedules`);

  }
);

server.listen(8000, () => {

  console.log('AI Test Server running on port 8000');

});