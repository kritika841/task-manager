module.exports = {
  apps: [
    {
      name: "task-manager",
      script: "npm",
      args: "start",
      cwd: "/home/deployer/apps/task-manager",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      out_file: "/home/deployer/logs/task-manager-out.log",
      error_file: "/home/deployer/logs/task-manager-error.log",
      time: true,
    },
  ],
};
