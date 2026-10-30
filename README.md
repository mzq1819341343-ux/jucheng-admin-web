# 聚成 · 业务总后台（前端）

本仓是 [jucheng-admin](https://github.com/mzq1819341343-ux/jucheng-admin) 的软拆结果，只保留页面、组件和面向页面的 `lib/`（Supabase 客户端、`data` / `brand`，以及计薪口径说明）。历史用 `git filter-repo` 按路径从单体仓 `main` 滤出，提交说明仍可追溯。

- 原单体仓（保留，不删除，不改写 `main`）：https://github.com/mzq1819341343-ux/jucheng-admin
- 运维 / schema / 抓数管道 / 文档：https://github.com/mzq1819341343-ux/jucheng-admin-ops

基线是单体仓 `main` 的 `4160298`（指令171 验收）。只改文档的提交在滤出后不会出现在本仓历史里；文件内容与该基线里的前端路径一致。未合并分支没有带入。

## 红线

- 禁止把工资原表和个人工资金额写进仓库。按人草案只在登录后从数据库读出，源码里不写姓名对应金额。
- 禁止把密钥、密码写进代码。真值只填本地 `.env.local` 与 Vercel 项目里已有的环境变量，仓库里只有 `.env.example`。
- 实时工资草案走只读 `GET /api/salary/realtime`（`salary_realtime_draft`）。已发布月度工资仍只走 `salary_monthly`。`lib/realtime-payroll.ts` 只留计薪口径，不放汇总额。上传开关在 ops 仓，`UPLOAD` / `APPLY` 保持 false。

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填 Supabase URL 与 anon key；没有密钥可以先不填
npm run dev                  # http://localhost:3000
npm run build                # 生产构建。缺环境变量时走演示数据
npm run lint                 # tsc --noEmit
```

未配置 Supabase 时为演示模式：兜底汇总与种子口径一致，页面可切换老板 / 合伙人 / 店员。

建表、种子、抓数管道和工资脚本在 ops 仓。在 Supabase SQL Editor 按该仓 README 执行 `supabase/schema.sql` 与 `supabase/seed.sql` 后，再把 URL 与 anon key 填进 `.env.local`。

`vercel.json` 随本仓迁入（区域 `hkg1`）。本次只迁代码，不改线上部署。

## 目录

```
app/            页面
components/     组件
lib/            页面数据层、品牌文案、Supabase 客户端、计薪口径
public/         帮助截图
proxy.ts        已配置 Supabase 时的登录保护
```

## 回归

`scripts/` 在 ops 仓。本仓 `package.json` 不再挂 `regression*`、`shots`、`salary:verify`。本地/演示回归在 [jucheng-admin-ops](https://github.com/mzq1819341343-ux/jucheng-admin-ops) 跑：须设 `REG_WEB_ROOT` 指向本仓根，并用 `REG_BASE` / `REG_ONLINE` 指向本仓预览或本地 `start`。
