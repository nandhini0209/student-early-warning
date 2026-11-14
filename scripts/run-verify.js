const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

console.log('🚀 Starting Student Early Alert System (SEAS) for automated verification...');
const srv = spawn('node', ['server.js'], {
  cwd: rootDir,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let started = false;
srv.stdout.on('data', (d) => {
  const msg = d.toString();
  process.stdout.write('[Server]: ' + msg);
  if (msg.includes('Student Early Alert System (Backend) running') || msg.includes('http://localhost:5000')) {
    if (!started) {
      started = true;
      runTests();
    }
  }
});

srv.stderr.on('data', (d) => {
  process.stderr.write('[Server Error]: ' + d.toString());
});

function runTests() {
  console.log('\n📡 Server confirmed live on port 5000. Launching test suite...\n');
  const testProc = spawn('node', [path.join(__dirname, 'test-system.js')], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit'
  });

  testProc.on('close', (code) => {
    console.log(`\n🏁 Test suite finished with exit code ${code}.`);
    srv.kill('SIGINT');
    process.exit(code);
  });
}
