module.exports = {
  apps: [
    {
      name: 'smmt-api',
      cwd: '/home/smmtai/public_html/apps/api',
      script: 'node',
      args: 'dist/index.js',
      env_file: '/home/smmtai/public_html/apps/api/.env',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'smmt-web',
      cwd: '/home/smmtai/public_html/apps/web',
      script: 'npx',
      args: 'vite preview --port 3016 --host 0.0.0.0',
      env: { NODE_ENV: 'production' },
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};

