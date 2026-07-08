# ========== 构建阶段 ==========
# 项目为零依赖原生 Node.js 应用，无需单独构建阶段
# 直接使用 Node.js alpine 轻量镜像运行
#
# 国内拉取 Docker Hub 镜像可能失败，已默认使用国内镜像加速源。
# 如需换回官方源或自定义源，构建时通过 --build-arg 指定：
#   docker build --build-arg NODE_IMAGE=node:20-alpine .
#   docker build --build-arg NODE_IMAGE=registry.cn-hangzhou.aliyuncs.com/library/node:20-alpine .
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine
FROM ${NODE_IMAGE}

# 设置工作目录
WORKDIR /app

# 创建非 root 用户运行服务，提升安全性
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 复制 package.json 并安装依赖
COPY package.json ./
RUN npm install --production && rm -rf ~/.npm

# 复制应用文件
COPY server.js workbench.html favicon.ico ./

# 创建数据目录并设置权限
RUN mkdir -p /app/data && \
    touch /app/data/data.json && \
    chown -R appuser:appgroup /app

# 切换到非 root 用户
USER appuser

# 对外暴露端口
EXPOSE 3110

# 环境变量默认值
ENV PORT=3110
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://lgc2025:lgc2025_pass_pg@postgresql:5432/workbench

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3110/api/data || exit 1

# 启动命令
CMD ["node", "server.js"]
