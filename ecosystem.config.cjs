module.exports = {
  apps: [
    {
      name: "task-manager",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4000",
      cwd: __dirname,
      env: { NODE_ENV: "production", PORT: 4000 },
      max_memory_restart: "512M",
    },
  ],
};
