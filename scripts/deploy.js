const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

require('dotenv').config();

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatNow() {
  // use an ISO 8601 UTC timestamp so DEPLOYED_AT is always in GMT/UTC
  return new Date().toISOString();
}

function upsertEnvVar(filePath, key, value) {
  try {
    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, { encoding: 'utf8' });
      const re = new RegExp('^' + key + '=.*$', 'm');
      if (re.test(content)) {
        content = content.replace(re, key + '=' + value);
      } else {
        if (content.length && !content.endsWith('\n')) content += '\n';
        content += key + '=' + value + '\n';
      }
    } else {
      // create directory if needed then write file
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      content = key + '=' + value + '\n';
    }
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    console.log(`Updated ${filePath} -> ${key}=${value}`);
  } catch (err) {
    console.warn(`Failed to update ${filePath}:`, err.message || err);
  }
}

// Can we force a restart?

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    // update deployment timestamp in env files before uploading
    const deployedAt = formatNow();
    const repoRoot = path.join(__dirname, '..');
    const envCandidates = [
      path.join(repoRoot, '.env'),
      path.join(repoRoot, 'dist', '.env'),
    ];
    envCandidates.forEach((fp) => upsertEnvVar(fp, 'DEPLOYED_AT', deployedAt));

    console.log('Connecting to FTP server...');
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      port: parseInt(process.env.FTP_PORT || '21'),
      secure: false // Set to true if using FTPS
    });

    console.log('Connected successfully!');
    
    const localDir = path.join(__dirname, '../dist');
    console.log("############# DEPLOYING TO FTP SERVER #############", localDir);
    
    // Check if dist folder exists
    if (!fs.existsSync(localDir)) {
      throw new Error('dist folder not found. Please run "npm run build" first.');
    }

    console.log('Uploading dist folder...');
    await client.uploadFromDir(localDir);

    console.log('Uploading .restart file...');
    const restartContent = `RESTART=${deployedAt}\n`;
    await client.uploadFrom(Readable.from([restartContent]), '.restart');

    console.log('Deployment completed successfully!');
  } catch (err) {
    console.error('Deployment failed:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
