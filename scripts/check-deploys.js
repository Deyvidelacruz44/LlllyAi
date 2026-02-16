const { execSync } = require('child_process');
try {
  const out = execSync('npx netlify api listSiteDeploys --data "{\\\"site_id\\\":\\\"7934ddd7-cf4d-411c-a3c9-2cda1b3d7270\\\"}"', { encoding: 'utf8' });
  const deploys = JSON.parse(out).slice(0, 8);
  deploys.forEach(d => {
    console.log(`${d.state.padEnd(10)} | ${d.created_at} | ${(d.error_message || '').substring(0, 60)} | ${d.title || ''}`);
  });
} catch (e) {
  console.error(e.message);
}
