module.exports = {
  apps : [{
    name   : "gemini-api",
    script : "./server.js",
    env: {
      // 在这里强制指定环境变量，确保 100% 能读取到
      GEMINI_API_KEYS: "",//可以有多个key，中间用逗号分隔
      AUTH_SECRET: "",
      PORT: 8080
    }
  }]
}