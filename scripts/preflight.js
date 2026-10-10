const net = require('net');

const PORT = 5000;

const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n❌ HRISense API could not start because port 5000 is already in use.');
    console.error('Please stop the existing HRISense API/dev process before starting another one.');
    console.error('\nTo safely find and kill the process on Windows PowerShell:');
    console.error('1. Find the PID:');
    console.error('   Get-NetTCPConnection -LocalPort 5000 -State Listen');
    console.error('2. Verify the process (e.g., node.exe):');
    console.error('   Get-Process -Id <PID>');
    console.error('3. Terminate it:');
    console.error('   Stop-Process -Id <PID> -Force\n');
    process.exit(1);
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.once('listening', () => {
  server.close();
  process.exit(0);
});

server.listen(PORT);
