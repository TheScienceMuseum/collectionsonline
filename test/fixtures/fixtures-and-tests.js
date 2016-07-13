const exec = require('child_process').exec;
const cmd = process.argv[2] === '--data' ? 'npm run copy-data && npm run test-all' : 'npm run test-all';
var childProcess = exec(cmd);
childProcess.stdout.pipe(process.stdout);
