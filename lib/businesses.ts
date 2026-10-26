/**
 * 业务板块定义（纯数据，无服务端依赖，客户端组件也可 import）。
 * 与 supabase 表 businesses 对应：id / name / status / sort。
 * en 为界面英文标签（英文加粗展示用），不入库。
 */
export interface BusinessDef {
  id: string;
  name: string;
  en: string;
  status: "active" | "coming_soon";
  sort: number;
}

export const FALLBACK_BUSINESSES: BusinessDef[] = [
  { id: "aihuishou", name: "爱回收", en: "AIHUISHOU", status: "active", sort: 1 },
  { id: "future", name: "更多业务", en: "EXPANDING", status: "coming_soon", sort: 99 },
];

export function businessEn(id: string): string {
  return FALLBACK_BUSINESSES.find((b) => b.id === id)?.en ?? id.toUpperCase();
}
