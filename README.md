# 假装购 FakeMart

假装购是一个虚拟综合购物和外卖模拟平台，支持微信小程序/H5 用户端、运营后台、MySQL 后端 API、用户行为记录、模拟订单和物流时间线。

## 本地启动

1. 安装依赖：

```bash
pnpm install
```

2. 启动开发数据库：

```bash
docker compose up -d mysql redis
```

如果使用本机 MySQL，可以直接创建 `.env`，例如：

```bash
DATABASE_URL="mysql://root:zty123456@127.0.0.1:3306/fakemart"
API_PORT=4000
API_HOST=0.0.0.0
CORS_ORIGIN="http://localhost:5173,http://localhost:10086"
JWT_SECRET="local-dev-fakemart-secret-change-before-release"
```

3. 准备环境变量：

```bash
cp .env.example .env
```

4. 初始化数据库：

```bash
pnpm db:init
```

5. 分别启动服务：

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:client
```

默认地址：

- API：http://localhost:4000
- 运营后台：http://localhost:5173
- 用户端 H5：http://localhost:10086

默认账号：

- 用户端：`demo / demo123456`
- 运营后台：`admin / admin123456`

## 常用命令

```bash
pnpm typecheck
pnpm build
pnpm --filter @fakemart/client build:weapp
pnpm db:init
pnpm db:seed
```
