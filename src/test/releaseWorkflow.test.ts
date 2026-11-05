import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Runs the macOS release steps from release.yml, in workflow order, against fake
// signing tools that behave as the real ones did in CI: Tauri signs the dmg but
// does not notarize it, and `stapler validate` exits 65 until a ticket is stapled.

const WORKFLOW = readFileSync(".github/workflows/release.yml", "utf8");
const TARGET = "aarch64-apple-darwin";
const VERSIONED = "Glimpse_0.5.0_aarch64.dmg";
const FIXED = "Glimpse_macos_arm64.dmg";

const FAKE_TOOLS: Record<string, string> = {
  xcrun: `#!/bin/bash
tool="$1 $2"
file="$3"
case "$tool" in
  "notarytool submit") touch "$file.accepted" ;;
  "stapler staple")
    [ -e "$file.accepted" ] || exit 65
    printf TICKET >> "$file"
    ;;
  "stapler validate")
    [ -d "$file" ] && exit 0
    if ! grep -q TICKET "$file"; then
      echo "$(basename "$file") does not have a ticket stapled to it."
      exit 65
    fi
    ;;
  *) echo "unexpected xcrun: $*"; exit 1 ;;
esac
`,
  codesign: `#!/bin/bash
echo "flags=0x10000(runtime)" >&2
`,
  spctl: `#!/bin/bash
exit 0
`,
  // Keeps each uploaded file as it was at upload time.
  gh: `#!/bin/bash
[ "$1 $2" = "release upload" ] || exit 1
shift 3
for arg in "$@"; do
  [ -f "$arg" ] && cp "$arg" "$UPLOADS/$(basename "$arg")"
done
exit 0
`,
};

interface Step {
  name: string;
  text: string;
  script: string;
}

function buildSteps(): Step[] {
  const job = WORKFLOW.slice(WORKFLOW.indexOf("\n  build:\n"));
  return job
    .split(/^ {6}- (?=name:|uses:)/m)
    .slice(1)
    .map((text) => {
      const lines = text.split("\n");
      const start = lines.findIndex((line) => line.endsWith("run: |"));
      const body = start < 0 ? [] : lines.slice(start + 1);
      const end = body.findIndex(
        (line) => line.trim() !== "" && !line.startsWith(" ".repeat(10)),
      );
      return {
        name: text.match(/^name: (.+)$/m)?.[1] ?? "",
        text,
        script: (end < 0 ? body : body.slice(0, end))
          .map((line) => line.slice(10))
          .join("\n"),
      };
    });
}

function stepsAfterBuild(): Step[] {
  const steps = buildSteps();
  return steps.slice(steps.findIndex((s) => s.name === "Build Tauri app") + 1);
}

describe.skipIf(process.platform === "win32")("release.yml macOS steps", () => {
  let root: string;
  let uploads: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "glimpse-release-"));
    uploads = join(root, "uploads");
    mkdirSync(uploads);

    const bin = join(root, "bin");
    mkdirSync(bin);
    for (const [name, script] of Object.entries(FAKE_TOOLS)) {
      writeFileSync(join(bin, name), script);
      chmodSync(join(bin, name), 0o755);
    }

    // What tauri-action leaves behind.
    const bundle = join(root, "src-tauri/target", TARGET, "release/bundle");
    mkdirSync(join(bundle, "macos/Glimpse.app"), { recursive: true });
    mkdirSync(join(bundle, "dmg"));
    writeFileSync(join(bundle, "dmg", VERSIONED), "signed dmg");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(step: Step) {
    return spawnSync("bash", ["-c", step.script], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${join(root, "bin")}:${process.env.PATH}`,
        UPLOADS: uploads,
        APPLE_ID: "id",
        APPLE_PASSWORD: "password",
        APPLE_TEAM_ID: "team",
        RUST_TARGET: TARGET,
        TAG: "v0.5.0",
        FIXED,
        GITHUB_REPOSITORY: "owner/repo",
      },
    });
  }

  function runAll(steps: Step[]) {
    for (const step of steps) {
      const result = run(step);
      if (result.status !== 0) {
        return { failedAt: step.name, ...result };
      }
    }
    return null;
  }

  it("passes verification and uploads only stapled dmgs", () => {
    expect(runAll(stepsAfterBuild())).toBeNull();

    expect(readdirSync(uploads).sort()).toEqual([FIXED, VERSIONED].sort());
    for (const name of readdirSync(uploads)) {
      expect(readFileSync(join(uploads, name), "utf8")).toContain("TICKET");
    }
  });

  it("fails verification when the dmg has no ticket", () => {
    const failure = runAll(
      stepsAfterBuild().filter((s) => s.name !== "Notarize dmg"),
    );

    expect(failure?.failedAt).toBe("Verify notarization");
    expect(failure?.status).toBe(65);
    expect(failure?.stdout).toContain("does not have a ticket stapled");
    expect(readdirSync(uploads)).toEqual([]);
  });

  it("gives the notarize step its credentials and the verify step's condition", () => {
    const steps = stepsAfterBuild();
    const notarize = steps.find((s) => s.name === "Notarize dmg")?.text;
    const verify = steps.find((s) => s.name === "Verify notarization")?.text;

    for (const name of ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"]) {
      expect(notarize).toContain(`${name}: \${{ secrets.${name} }}`);
    }
    const condition = /^ +if: .+$/m;
    expect(notarize?.match(condition)?.[0]).toBe(verify?.match(condition)?.[0]);
  });
});
