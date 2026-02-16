const fs = require('fs');
const path = require('path');

function fixPaths() {
  const handlerFile = path.join(
    '.netlify',
    'functions-internal',
    '___netlify-server-handler',
    '___netlify-server-handler.mjs'
  );

  if (!fs.existsSync(handlerFile)) {
    console.log('Handler file not found, skipping path fix.');
    return;
  }

  let content = fs.readFileSync(handlerFile, 'utf8');
  const original = content;

  // Fix all Windows backslash paths in single-quoted and backtick strings
  // that start with \var\task\ (Netlify's server path prefix)
  // The backslashes cause octal escape errors in ESM strict mode
  // e.g. '\var\task\Desktop\2026\...' -> '/var/task/Desktop/2026/...'
  content = content.replace(/(['`])\\var\\task\\([^'`]*)\1/g, (match, quote, rest) => {
    const fixed = '/var/task/' + rest.replace(/\\/g, '/');
    return quote + fixed + quote;
  });

  if (content !== original) {
    fs.writeFileSync(handlerFile, content, 'utf8');
    console.log('Fixed Windows backslash paths in Netlify server handler.');
  } else {
    console.log('No backslash paths found to fix.');
  }
}

module.exports = {
  onBuild: fixPaths,
};
