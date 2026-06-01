const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const UPDATE_URL = 'https://api.github.com/repos/YOUR_USER/mineserver/releases/latest';
const CURRENT_VERSION = '1.0.0';

function getPlatformAsset(release) {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') return release.assets.find(a => a.name.includes('win') || a.name.endsWith('.exe'));
  if (platform === 'darwin') return release.assets.find(a => a.name.includes('mac') || a.name.includes('darwin'));
  if (platform === 'linux') return release.assets.find(a => a.name.includes('linux'));
  return null;
}

async function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const req = https.get(UPDATE_URL, {
      headers: {
        'User-Agent': 'MineServer-Agent',
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(body);
          const latestVersion = release.tag_name.replace(/^v/, '');
          if (latestVersion !== CURRENT_VERSION) {
            const asset = getPlatformAsset(release);
            resolve({ hasUpdate: true, version: latestVersion, asset, release });
          } else {
            resolve({ hasUpdate: false });
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function downloadAndUpdate(asset, newVersion) {
  return new Promise((resolve, reject) => {
    if (!asset?.browser_download_url) {
      reject(new Error('No download URL found'));
      return;
    }

    const agentPath = process.execPath;
    const updateDir = path.dirname(agentPath);
    const updateFile = path.join(updateDir, `mineserver-agent-${newVersion}${path.extname(agentPath)}`);
    const backupFile = path.join(updateDir, `mineserver-agent-${CURRENT_VERSION}.backup`);

    console.log(`Downloading update v${newVersion}...`);

    const file = fs.createWriteStream(updateFile);
    https.get(asset.browser_download_url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Download complete. Applying update...');

        // Backup current binary
        if (fs.existsSync(agentPath)) {
          fs.renameSync(agentPath, backupFile);
        }

        // Move new binary into place
        fs.renameSync(updateFile, agentPath);
        fs.chmodSync(agentPath, '755');

        console.log('Update applied. Restarting...');

        // Restart agent
        const child = spawn(agentPath, [], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        process.exit(0);
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlinkSync(updateFile);
      reject(err);
    });
  });
}

module.exports = { checkForUpdates, downloadAndUpdate };

// Run as standalone
if (require.main === module) {
  checkForUpdates().then(result => {
    if (result.hasUpdate) {
      console.log(`Update available: v${result.version}`);
      return downloadAndUpdate(result.asset, result.version);
    } else {
      console.log('Already up to date.');
    }
  }).catch(err => {
    console.error('Update check failed:', err.message);
  });
}
