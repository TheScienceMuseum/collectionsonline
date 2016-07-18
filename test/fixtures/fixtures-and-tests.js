const exec = require('child_process').execSync;
if (process.argv[2] === '--data') {
  const cmd = 'npm run copy-data';
  exec(cmd);
  console.log('DATA UPDATED');
}
