module.exports = {
  apps: [
    {
      name: "que-wh",
      // Menjalankan Next.js produksi yang mendengarkan di semua IP jaringan WLAN (0.0.0.0)
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: "./",
      instances: 1, // 1 instance direkomendasikan agar Server-Sent Events (SSE) realtime berjalan stabil tanpa sinkronisasi Redis
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
