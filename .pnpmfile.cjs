// vitest 4.1 は vite を dependency と peer の両方に持つ。peer はプロジェクトの
// vite 5 に解決されて起動できない（vite 6 以降の vite/module-runner を読む）ため、
// peer を外して vitest 自身の dependency の vite を使わせる。
function readPackage(pkg) {
  if (pkg.name === "vitest" && pkg.peerDependencies) {
    delete pkg.peerDependencies.vite;
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
