import {BarChart,Bar,XAxis,YAxis,Tooltip} from 'recharts';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';
const API_URL = import.meta.env.VITE_API_URL || '${API_URL}';

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [stats, setStats] = useState({
    total: 0,
    passed: 0,
    failed: 0
  });

  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [scheduleStatus, setScheduleStatus] = useState('No schedule active');
  const [projectName, setProjectName] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [url, setUrl] = useState('');
  const [popup, setPopup] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [logs, setLogs] = useState('');
  const [progress, setProgress] = useState(0);
  const [aiReport, setAiReport] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [scanResults, setScanResults] = useState(null);
  const [testStatus, setTestStatus] = useState('Idle');

  const loadProjects = async () => {
    const token = localStorage.getItem('ai-token');

    const response = await fetch('${API_URL}/projects', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      setProjects(data.projects);
    }
  };

  const loadTestHistory = async () => {
    const token = localStorage.getItem('ai-token');

    const response = await fetch('${API_URL}/test-history', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {

  setTestHistory(data.history);

  if (data.history.length > 0) {

    const latest = data.history[0];

    setStats({

      total: latest.total,

      passed: latest.passed,

      failed: latest.failed

    });

  }

}
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('ai-user');

    if (savedUser) {
      setUser(JSON.parse(savedUser));
      loadProjects();
      loadTestHistory();
    }

    const socket = io('${API_URL}');

    socket.on('test-log', (data) => {
      setLogs((prevLogs) =>
        prevLogs + data.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
      );
    });

    return () => socket.disconnect();
  }, []);

  const handleAuthChange = (e) => {
    setAuthForm({
      ...authForm,
      [e.target.name]: e.target.value
    });
  };

  const signup = async () => {
    const response = await fetch('${API_URL}/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm)
    });

    const data = await response.json();
    setPopup(data.message);

    if (data.success) {
      setAuthMode('login');
    }
  };

  const login = async () => {
    const response = await fetch('${API_URL}/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authForm.email,
        password: authForm.password
      })
    });

    const data = await response.json();
    setPopup(data.message);

    if (data.success) {
      localStorage.setItem('ai-token', data.token);
      localStorage.setItem('ai-user', JSON.stringify(data.user));
      setUser(data.user);
      loadProjects();
      loadTestHistory();
    }
  };

  const logout = () => {
    localStorage.removeItem('ai-token');
    localStorage.removeItem('ai-user');
    setUser(null);
  };

  const createProject = async () => {
    if (!projectName || !projectUrl) {
      setPopup('Project name and URL are required');
      return;
    }

    const token = localStorage.getItem('ai-token');

    const response = await fetch('${API_URL}/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: projectName,
        url: projectUrl
      })
    });

    const data = await response.json();
    setPopup(data.message);

    if (data.success) {
      setProjectName('');
      setProjectUrl('');
      loadProjects();
    }
  };

  const selectProject = (project) => {
  setSelectedProject(project);
  setUrl(project.url);
  setPopup(`Selected project: ${project.name}`);
  loadProjectSchedule(project.id);
};

  const scanSite = async () => {
    if (!url) {
      setPopup('Please enter a URL first');
      return;
    }

    setPopup('Scanning website...');

    const response = await fetch(
      `${API_URL}/scan-site?url=${encodeURIComponent(url.trim())}`
    );

    const data = await response.json();

    if (data.success) {
      setScanResults(data.results);
      setPopup('Website scan completed');
    } else {
      setPopup(data.message);
    }
  };

  const generateTest = async () => {
    if (!url) {
      setPopup('Please enter a URL first');
      return;
    }

    const response = await fetch(
      `${API_URL}/generate-test?url=${encodeURIComponent(url.trim())}`
    );

    const data = await response.json();

    setGeneratedCode(data.code || '');
    setPopup(data.message);
  };

  const generateSuite = async () => {
    if (!url) {
      setPopup('Please enter a URL first');
      return;
    }

    const response = await fetch(
      `${API_URL}/generate-suite?url=${encodeURIComponent(url.trim())}`
    );

    const data = await response.json();

    setPopup(data.message);
  };

  const getBrowserImpact = (logs) => {

  const chromiumFailed =
    logs.includes('[chromium]') &&
    logs.includes('intentional-failure');

  const firefoxFailed =
    logs.includes('[firefox]') &&
    logs.includes('intentional-failure');

  const webkitFailed =
    logs.includes('[webkit]') &&
    logs.includes('intentional-failure');

  return {
    chromium: chromiumFailed,
    firefox: firefoxFailed,
    webkit: webkitFailed
  };

};

const scheduleTests = async () => {

  const token = localStorage.getItem('ai-token');

  const response = await fetch('${API_URL}/schedule-tests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      frequency: scheduleFrequency,
      project_id: selectedProject?.id
    })
  });

  const data = await response.json();

  setScheduleStatus(data.message);
  setPopup(data.message);

};

const loadProjectSchedule = async (projectId) => {

  const token = localStorage.getItem('ai-token');

  const response = await fetch(`${API_URL}/schedule/${projectId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (data.success && data.schedule) {
    setScheduleStatus(`Current schedule: ${data.schedule.frequency}`);
    setScheduleFrequency(data.schedule.frequency);
  } else {
    setScheduleStatus('No schedule active');
  }

};

const stopSchedule = async () => {

  const token = localStorage.getItem('ai-token');

  const response = await fetch('${API_URL}/stop-schedule', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  setScheduleStatus(data.message);
  setPopup(data.message);

};

  const runTests = async () => {
    setLogs('');
    setPopup('Running AI Tests...');
    setTestStatus('Running AI tests...');
    setProgress(15);

    try {
      const response = await fetch('${API_URL}/run-tests');
      const data = await response.json();

      setProgress(75);
      setScreenshots(data.screenshots || []);

      const output = data.output || '';
      let report = '';

      if (output.includes('toContainText')) {
        report += `
❌ AI DETECTED FAILURE

Reason:
Expected text did not match actual webpage text.

Possible Causes:
- Wrong selector
- Website content changed
- Incorrect expected value

AI Suggested Fix:
Update expected text inside failure-test.spec.js
`;
      }

      const failedSelectorMatch = output.match(/Locator:\s+locator\(['"`](.*?)['"`]\)/s);

const failedSelector = failedSelectorMatch
  ? failedSelectorMatch[1]
  : 'Unknown selector';

      if (output.includes('element(s) not found')) {
  report += `
🚨 AI FAILURE DIAGNOSIS

Likely Cause:
Element selector not found on the page.

Detected Issue:
The test searched for an element that does not exist.

Failed Selector:
${failedSelector}

Browser Impact:
Chromium / Firefox / WebKit

AI Recommendation:
- Replace unstable text selectors
- Prefer data-testid selectors
- Re-scan the website to generate updated selectors

Confidence:
HIGH
`;
}

      if (
        output.includes('Primary selector failed') ||
        output.includes('AI found working selector') ||
        output.includes('AI self-healing successful')
      ) {
        report += `

🤖 SELF-HEALING ACTIVATED

AI detected broken selectors and recovered automatically using alternative selector.
`;
      }

      setAiReport(report);

      const passedMatch = output.match(/(\d+)\s+passed/);
      const failedMatch = output.match(/(\d+)\s+failed/);

      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const total = passed + failed;

      setStats({
        total,
        passed,
        failed
      });
     const cleanOutput = output
     .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
     .replace(/\(node:.*DEP0205.*\n/g, '')
     .replace(/\(Use `node --trace-deprecation.*\n/g, '');

      const token = localStorage.getItem('ai-token');

      if (selectedProject) {
        await fetch('${API_URL}/test-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            project_id: selectedProject.id,
            project_name: selectedProject.name,
            total,
            passed,
            failed,
            logs: cleanOutput
          })
        });

        loadTestHistory();
      }

      setLogs(
        (data.output || data.warnings)
          .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
          .replace(/\(node:.*DEP0205.*\n/g, '')
          .replace(/\(Use `node --trace-deprecation.*\n/g, '')
      );

      setProgress(100);
      setTestStatus('Test execution completed');

      setPopup(data.success ? '✅ AI Tests Completed' : '⚠️ Tests completed with failures');
    } catch (error) {
      console.log(error);
      setPopup('Server Connection Failed');
    }
  };

  const autonomousAITest = async () => {
    if (!url) {
      setPopup('Please enter a URL first');
      return;
    }

    await scanSite();
    await generateTest();
    await generateSuite();
    await runTests();
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>🤖 AI Tester</h1>
          <p>AI-powered software testing platform</p>

          <h2>{authMode === 'login' ? 'Login' : 'Create Account'}</h2>

          {authMode === 'signup' && (
            <input
              name="name"
              placeholder="Name"
              value={authForm.name}
              onChange={handleAuthChange}
            />
          )}

          <input
            name="email"
            placeholder="Email"
            value={authForm.email}
            onChange={handleAuthChange}
          />

          <input
            name="password"
            placeholder="Password"
            type="password"
            value={authForm.password}
            onChange={handleAuthChange}
          />

          <button onClick={authMode === 'login' ? login : signup}>
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>

          <p className="switch-auth">
            {authMode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
            <span onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
              {authMode === 'login' ? 'Sign up' : 'Login'}
            </span>
          </p>
        </div>

        {popup && (
          <div className="popup">
            <p>{popup}</p>
            <button onClick={() => setPopup('')}>Close</button>
          </div>
        )}
      </div>
    );
  }

  const totalRuns = testHistory.length;

const totalProjects = projects.length;

const latestRun = testHistory[0];

const passRate = latestRun
  ? Math.round((latestRun.passed / latestRun.total) * 100)
  : 0;

const failRate = latestRun
  ? Math.round((latestRun.failed / latestRun.total) * 100)
  : 0;

  const chartData = testHistory

  .slice(0, 5)

  .reverse()

  .map((item) => ({

    name: item.project_name,

    passed: item.passed,

    failed: item.failed

  }));

  const flakyDetected =
  testHistory.length >= 2 &&
  testHistory.some((item) => item.failed > 0) &&
  testHistory.some((item) => item.passed > 0);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🤖</div>
          <h2>AI Tester</h2>
          <p>Smart Test Automation</p>
        </div>

        <nav>
          <a className="active">Dashboard</a>
          <a>Projects</a>
          <a>Test History</a>
          <a>Reports</a>
          <a>Settings</a>
        </nav>

        <div className="system-card">
          <span className="green-dot"></span>
          <h4>{user.name}</h4>
          <p>{user.email}</p>
          <button onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="hero">
          <div>
            <h1>🚀 AI Testing Platform Dashboard</h1>
            <p>Welcome back, {user.name}. Build, test, and heal web apps automatically.</p>
          </div>

          <button
            className="report-btn"
            onClick={() => window.open('${API_URL}/download-report')}
          >
            📄 Download PDF Report
          </button>
        </header>

        <section className="control-panel">
          <input
            type="text"
            placeholder="Enter website URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <div className="button-grid">
            <button onClick={scanSite}>🔍 Scan Website</button>
            <button onClick={generateTest}>🧠 Generate AI Test</button>
            <button onClick={generateSuite}>📦 Generate Test Suite</button>
            <button className="orange" onClick={autonomousAITest}>🚀 Autonomous AI Test</button>
          </div>

          <button className="run-btn" onClick={runTests}>
            ▶ Run AI Tests
          </button>
        </section>

        <section className="panel">
          <h2>🏢 Project Workspace</h2>

          <div className="project-form">
            <input
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Project URL"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
            />

            <button onClick={createProject}>
              ➕ Create Project
            </button>
          </div>

          <div className="project-list">
            {projects.length === 0 ? (
              <p>No projects yet. Create your first project.</p>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => selectProject(project)}
                >
                  <h3>{project.name}</h3>
                  <p>{project.url}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h2>📜 Test History</h2>

          <div className="history-list">
            {testHistory.length === 0 ? (
              <p>No test history yet.</p>
            ) : (
              testHistory.map((item) => (
                <div key={item.id} className="history-card"
                onClick={() => setSelectedHistory(item)}>
                  <h3>{item.project_name}</h3>
                  <p>✅ {item.passed} Passed | ❌ {item.failed} Failed</p>
                  <p>Total: {item.total}</p>
                  <small>{new Date(item.created_at + 'Z').toLocaleString('de-DE')}</small>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">

          {selectedHistory && (

  <section className="panel investigation-panel">

    <h2>🧪 Failure Investigation</h2>

    <p><strong>Project:</strong> {selectedHistory.project_name}</p>
    <p><strong>Total:</strong> {selectedHistory.total}</p>
    <p><strong>Passed:</strong> {selectedHistory.passed}</p>
    <p><strong>Failed:</strong> {selectedHistory.failed}</p>
    <p><strong>Run Time:</strong> {new Date(selectedHistory.created_at + 'Z').toLocaleString('de-DE')}</p>

{selectedHistory.failed > 0 && (
  <div className="browser-impact">

    <h3>🌐 Browser Impact</h3>

    <p>
      {getBrowserImpact(selectedHistory.logs).chromium ? '❌' : '✅'} Chromium
    </p>

    <p>
      {getBrowserImpact(selectedHistory.logs).firefox ? '❌' : '✅'} Firefox
    </p>

    <p>
      {getBrowserImpact(selectedHistory.logs).webkit ? '❌' : '✅'} WebKit
    </p>

  </div>
)}

    <h3>AI Diagnosis</h3>

    {selectedHistory.failed > 0 ? (
      <pre>
{`🚨 Failure detected

Likely Cause:
One or more selectors/assertions failed.

Recommendation:
Review failed selectors, screenshots, and logs.
Use stable data-testid selectors where possible.

Confidence:
HIGH`}
      </pre>
    ) : (
      <pre>
{`✅ No failures detected

This run appears stable.`}
      </pre>
    )}

    <h3>Execution Logs</h3>
    <pre>
  {selectedHistory.logs
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\(node:.*DEP0205.*\n/g, '')
    .replace(/\(Use `node --trace-deprecation.*\n/g, '')}
</pre>

    <button onClick={() => setSelectedHistory(null)}>
      Close Investigation
    </button>

  </section>

)}

  <h2>📊 Analytics Dashboard</h2>

  <div className="analytics-grid">

    <div className="analytics-card">
      <h3>Pass Rate</h3>
      <p>{passRate}%</p>
    </div>

    <div className="analytics-card">
      <h3>Fail Rate</h3>
      <p>{failRate}%</p>
    </div>

    <div className="analytics-card">
      <h3>Total Projects</h3>
      <p>{totalProjects}</p>
    </div>

    <div className="analytics-card">
      <h3>Total Runs</h3>
      <p>{totalRuns}</p>
    </div>

  </div>
{latestRun && (
  <>
    <div className="latest-run">
      Latest Run: <strong>{latestRun.project_name}</strong> — ✅ {latestRun.passed} passed / ❌ {latestRun.failed} failed
    </div>

    <div className="chart-box">
      <h3>Recent Test Runs</h3>

      <BarChart width={600} height={300} data={chartData}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="passed" fill="#22c55e" />
        <Bar dataKey="failed" fill="#ef4444" />
      </BarChart>
    </div>

    <div className={flakyDetected ? 'flaky-box warning' : 'flaky-box good'}>
      <h3>⚠️ Flaky Test Detection</h3>

      {flakyDetected ? (
        <p>Potential flaky behavior detected. Some runs passed and some runs failed.</p>
      ) : (
        <p>No flaky behavior detected. Test runs are stable so far.</p>
      )}
    </div>

  </>
)}
</section>

        <section className="panel">

  <h2>⏰ Scheduled Test Runs</h2>

  <div className="schedule-box">

    <select
      value={scheduleFrequency}
      onChange={(e) => setScheduleFrequency(e.target.value)}
    >
      <option value="hourly">Every Hour</option>
      <option value="daily">Daily at 9 AM</option>
      <option value="weekly">Weekly Monday 9 AM</option>
    </select>

    <button onClick={scheduleTests}>
      Start Schedule
    </button>

    <button onClick={stopSchedule}>
      Stop Schedule
    </button>

  </div>

  <p>{scheduleStatus}</p>

</section>

        <section className="status-panel">
          <h2>✅ {testStatus}</h2>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card blue">
            <span>📋</span>
            <div>
              <h3>Total Tests</h3>
              <p>{stats.total}</p>
            </div>
          </div>

          <div className="stat-card green">
            <span>✅</span>
            <div>
              <h3>Passed Tests</h3>
              <p>{stats.passed}</p>
            </div>
          </div>

          <div className="stat-card red">
            <span>❌</span>
            <div>
              <h3>Failed Tests</h3>
              <p>{stats.failed}</p>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          {scanResults && (
            <div className="panel">
              <h2>🕷️ Website Scan Results</h2>

              <div className="scan-box">
                <h3>Links Found</h3>
                <p>{scanResults.links.length}</p>
              </div>

              <div className="scan-box">
                <h3>Buttons Found</h3>
                <p>{scanResults.buttons.length}</p>
              </div>

              <div className="scan-box">
                <h3>Inputs Found</h3>
                <p>{scanResults.inputs}</p>
              </div>
            </div>
          )}

          <div className="panel code-panel">
            <h2>🧠 Generated Test Preview</h2>
            <pre>{generatedCode || '// Generated test code will appear here'}</pre>
          </div>

          <div className="panel logs-panel">
            <h2>📟 Live Test Logs <span>● Live</span></h2>
            <pre>{logs || 'Waiting for test execution...'}</pre>
          </div>

          <div className="panel screenshots-panel">
            <h2>📸 Failure Screenshots</h2>

            <div className="screenshots-grid">
              {screenshots.length === 0 ? (
                <p>No failure screenshots yet.</p>
              ) : (
                screenshots.map((shot, index) => (
                  <img
                    key={index}
                    src={shot}
                    alt="failure screenshot"
                    className="shot"
                  />
                ))
              )}
            </div>
          </div>

          <div className="panel ai-panel">
            <h2>🤖 AI Bug Analysis</h2>
            <pre>{aiReport || 'AI analysis will appear after test execution.'}</pre>
          </div>
        </section>

        {popup && (
          <div className="popup">
            <p>{popup}</p>
            <button onClick={() => setPopup('')}>Close</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;