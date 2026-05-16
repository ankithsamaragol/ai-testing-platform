const express = require('express');

const http = require('http');

const { Server } = require('socket.io');

const { exec } = require('child_process');

const cors = require('cors');

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {

  console.log('Client connected');

  socket.on('run-tests', () => {

    const testProcess = exec(
      'npx playwright test',
      {
        cwd: __dirname
      }
    );

    testProcess.stdout.on('data', (data) => {

      socket.emit('test-log', data);

    });

    testProcess.stderr.on('data', (data) => {

      socket.emit('test-log', data);

    });

    testProcess.on('close', () => {

      socket.emit('test-complete');

    });

  });

});

server.listen(8000, () => {

  console.log('AI Testing Server running on port 8000');

});