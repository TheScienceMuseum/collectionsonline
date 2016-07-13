const exec = require('child_process').exec;
const cmd = process.argv[2] === '--data' ? 'npm run copy-data && npm run test-all' : 'npm run test-all';
var childProcess = exec(cmd);
childProcess.stdout.pipe(process.stdout);

// const spawn = require('child_process').spawn;
// var child = spawn('npm', ['run', 'test-all']);
// child.stdout.on('data', function (data) {
//   console.log('stdout: ' + data);
//   // Here is where the output goes
// });
// child.stderr.on('data', function (data) {
//   console.log('stderr: ' + data);
//   // Here is where the error output goes
// });
// child.on('close', function (code) {
//   console.log('closing code: ' + code);
//   // Here you can get the exit code of the script
// });
