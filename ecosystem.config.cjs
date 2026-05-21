module.exports = {
  apps: [
    {
      name: 'retail-ready-audit',
      script: '.next/standalone/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      max_memory_restart: '512M',
      instances: 1,
      exec_mode: 'fork',
      watch: false
    }
  ]
};
