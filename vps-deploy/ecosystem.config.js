module.exports = {
  apps: [
    {
      name: "fitmotor-api-bridge",
      cwd: "./api",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "fitmotor-dash-master",
      script: "npx",
      args: "serve -s dist -l 5000",
      cwd: "./frontend",
      instances: 1,
      autorestart: true,
    },
    {
      name: "fitmotor-dash-adiwerna",
      script: "npx",
      args: "serve -s dist -l 5001",
      cwd: "./frontend",
      instances: 1,
      autorestart: true,
    },
    {
      name: "fitmotor-dash-pesalakan",
      script: "npx",
      args: "serve -s dist -l 5002",
      cwd: "./frontend",
      instances: 1,
      autorestart: true,
    },
    {
      name: "fitmotor-dash-pacul",
      script: "npx",
      args: "serve -s dist -l 5003",
      cwd: "./frontend",
      instances: 1,
      autorestart: true,
    },
    {
      name: "fitmotor-dash-cikditiro",
      script: "npx",
      args: "serve -s dist -l 5004",
      cwd: "./frontend",
      instances: 1,
      autorestart: true,
    }
  ]
};
