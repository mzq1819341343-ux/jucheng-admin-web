/**
 * 数据层入口（指令68-P0-2 拆分）：实现按域拆到两个兄弟模块，本文件只做转发，
 * 既有 `@/lib/data` 导入路径与全部导出名保持不变（零行为变更）。
 * - data-core：用户/角色、多业务授权、经营指标、成员与待邀请、抓取日志；
 * - data-finance：工资规则与薪酬、月度目标、门店成本、报销、合同与配置新鲜度。
 *
 * 指令132 A3（去瀑布）：全部只读取数函数在此统一包一层 React cache()——
 * 同一请求内页面 / 布局 / Nav 等多处重复调用（如 getCurrentUser、
 * getMyBusinesses）只真正发一次网络往返，后续命中请求级缓存。
 * 函数均为只读查询、无跨请求状态，请求内复用不改变任何口径与权限判定；
 * 原始实现仍在两个兄弟模块内，内部互调不受影响。
 */
import { cache } from "react";
import {
  getCurrentUser as getCurrentUserImpl,
  getMyBusinesses as getMyBusinessesImpl,
  getMetrics as getMetricsImpl,
  getAllMembers as getAllMembersImpl,
  getMemberInvites as getMemberInvitesImpl,
  getFetchLogs as getFetchLogsImpl,
  getFetchRefreshMarker as getFetchRefreshMarkerImpl,
} from "./data-core";
import {
  getSiteTargets as getSiteTargetsImpl,
  getSalaryRules as getSalaryRulesImpl,
  getPublicSalaryRule as getPublicSalaryRuleImpl,
  getMySalary as getMySalaryImpl,
  getAllSalaryMonthly as getAllSalaryMonthlyImpl,
  getSalaryDetailImport as getSalaryDetailImportImpl,
  getSalaryStoreAgg as getSalaryStoreAggImpl,
  getStoreCosts as getStoreCostsImpl,
  getExpenseClaims as getExpenseClaimsImpl,
  getExpenseMonthlyAgg as getExpenseMonthlyAggImpl,
  getExpenseOperatingInput as getExpenseOperatingInputImpl,
  getStoreContracts as getStoreContractsImpl,
  getConfigFreshness as getConfigFreshnessImpl,
} from "./data-finance";

export * from "./data-core";
export * from "./data-finance";

export const getCurrentUser = cache(getCurrentUserImpl);
export const getMyBusinesses = cache(getMyBusinessesImpl);
export const getMetrics = cache(getMetricsImpl);
export const getAllMembers = cache(getAllMembersImpl);
export const getMemberInvites = cache(getMemberInvitesImpl);
export const getFetchLogs = cache(getFetchLogsImpl);
export const getFetchRefreshMarker = cache(getFetchRefreshMarkerImpl);

export const getSiteTargets = cache(getSiteTargetsImpl);
export const getSalaryRules = cache(getSalaryRulesImpl);
export const getPublicSalaryRule = cache(getPublicSalaryRuleImpl);
export const getMySalary = cache(getMySalaryImpl);
export const getAllSalaryMonthly = cache(getAllSalaryMonthlyImpl);
export const getSalaryDetailImport = cache(getSalaryDetailImportImpl);
export const getSalaryStoreAgg = cache(getSalaryStoreAggImpl);
export const getStoreCosts = cache(getStoreCostsImpl);
export const getExpenseClaims = cache(getExpenseClaimsImpl);
export const getExpenseMonthlyAgg = cache(getExpenseMonthlyAggImpl);
export const getExpenseOperatingInput = cache(getExpenseOperatingInputImpl);
export const getStoreContracts = cache(getStoreContractsImpl);
export const getConfigFreshness = cache(getConfigFreshnessImpl);
