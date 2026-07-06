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

# 复制应用文件
# 先复制 package.json（若将来引入依赖可利用 Docker 缓存层）
# 本项目零依赖，直接复制源码
COPY server.js workbench.html ./

# 创建数据目录并设置权限（data.json 由运行时写入）
RUN mkdir -p /app/data && \
    touch /app/data.json && \
    chown -R appuser:appgroup /app

# 切换到非 root 用户
USER appuser

# 对外暴露端口
EXPOSE 3110

# 声明数据卷（data.json 持久化）
VOLUME ["/app/data.json"]

# 环境变量默认值
ENV PORT=3110
ENV NODE_ENV=production

# 健康检查：每 30 秒检测一次服务是否存活
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3110/api/data || exit 1

# 启动命令
CMD ["node", "server.js"]
