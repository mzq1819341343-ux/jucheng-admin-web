/**
 * 乐观更新共享骨架（指令68-P0-6/P0-7）：先改 UI（apply），请求成功以服务端
 * 结果校准（commit），失败/异常回滚（rollback）并把原始错误交 onError 组织文案。
 * 各组件只保留自己的 apply/commit/文案，不再各写一份 try/catch 快照逻辑。
 * 演示/未配置路径不走本 helper（原本即本地即时更新）。
 */
export interface OptimisticError {
  message: string;
  code?: string;
}

export async function runOptimistic<T>(opts: {
  /** 立即把预期结果写进 UI。 */
  apply: () => void;
  /** 失败时恢复 apply 前的快照。 */
  rollback: () => void;
  /** 实际请求；返回 { data, error }（删除类无 data 时给 null）。抛错按失败处理。 */
  request: () => Promise<{ data: T | null; error: OptimisticError | null }>;
  /** 成功且有 data 时以服务端结果校准 UI。 */
  commit?: (data: T) => void;
  /** 失败回调：message 为原始错误信息，raw 供需要看 code 的调用方（如重复键）。 */
  onError: (message: string, raw?: unknown) => void;
}): Promise<boolean> {
  opts.apply();
  try {
    const { data, error } = await opts.request();
    if (error) {
      opts.rollback();
      opts.onError(error.message, error);
      return false;
    }
    if (data != null && opts.commit) opts.commit(data);
    return true;
  } catch (err) {
    opts.rollback();
    opts.onError(err instanceof Error ? err.message : "未知错误", err);
    return false;
  }
}
