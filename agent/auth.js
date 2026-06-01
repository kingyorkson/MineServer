const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUPABASE_URL = 'https://pejspqyupuanndshwoxb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZFJLxUp0mqVMyAjkhynXTA_Vb8z8mO4';
const CONFIG_PATH = path.join(os.homedir(), '.mineserver', 'agent-config.json');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('');
    console.log('MineServer Agent Authentication');
    console.log('===============================');
    console.log('');
    console.log('Options:');
    console.log('  node auth.js discord       Sign in with Discord');
    console.log('  node auth.js local <user> <pass>   Sign in with local account');
    console.log('  node auth.js tokens <access> <refresh>   Set tokens directly');
    console.log('  node auth.js status        Check auth status');
    console.log('  node auth.js logout        Clear stored session');
    console.log('');
    return;
  }

  const cmd = args[0];

  if (cmd === 'discord') {
    console.log('Opening Discord sign-in... (run this on a machine with a browser)');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        skipBrowserRedirect: true,
        redirectTo: 'http://localhost:5342/'
      }
    });
    if (error) { console.error('Error:', error.message); return; }
    if (data?.url) {
      console.log('');
      console.log('Visit this URL in your browser:');
      console.log(data.url);
      console.log('');
      console.log('After signing in, you will be redirected to a localhost page.');
      console.log('Copy the access_token and refresh_token from the URL, then run:');
      console.log('  node auth.js tokens <access_token> <refresh_token>');
    }
    return;
  }

  if (cmd === 'local' && args.length >= 3) {
    const username = args[1];
    const password = args[2];
    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@mineserver.local`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { console.error('Error:', error.message); return; }
    saveSession(data.session);
    console.log('Authenticated as: ' + username);
    return;
  }

  if (cmd === 'tokens' && args.length >= 3) {
    const config = { access_token: args[1], refresh_token: args[2] };
    const { data, error } = await supabase.auth.setSession(config);
    if (error) { console.error('Error:', error.message); return; }
    saveSession(data.session);
    console.log('Tokens validated and saved.');
    return;
  }

  if (cmd === 'status') {
    const config = loadConfig();
    if (!config) { console.log('No stored session.'); return; }
    const { data, error } = await supabase.auth.setSession({
      access_token: config.access_token,
      refresh_token: config.refresh_token
    });
    if (error) { console.log('Session expired. Re-auth required.'); return; }
    console.log('Authenticated as: ' + data.user?.email);
    console.log('User ID: ' + data.user?.id);
    return;
  }

  if (cmd === 'logout') {
    const dir = path.dirname(CONFIG_PATH);
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log('Session cleared.');
    } else {
      console.log('No session to clear.');
    }
    return;
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveSession(session) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const config = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log('Session saved to: ' + CONFIG_PATH);
}

main().catch(console.error);
