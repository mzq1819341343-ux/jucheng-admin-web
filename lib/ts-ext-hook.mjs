/**
 * node:test 加载 .ts 时补上无扩展名的相对导入。
 * 运行：node --experimental-strip-types --import ./lib/ts-ext-hook.mjs --test lib/commission-rules.test.ts
 */
import path from "node:path";
import { register } from "node:module";

register(import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    path.extname(specifier) === ""
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
