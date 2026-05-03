#!/usr/bin/env python3
"""Python CLI facade for ppttr Node.js core engine.

This wrapper:
- Checks that bun/node is available
- Checks that dist/cli.js exists (built TypeScript project)
- Transparently passes all CLI args and environment variables
- Calls the Node.js/bun core engine
"""
from __future__ import annotations

import os
import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
CLI_JS = PROJECT_ROOT / "dist" / "cli.js"


def _find_runtime() -> str:
    """Find bun or node runtime. Returns runtime name or exits with error."""
    # Prefer bun
    for runtime in ("bun", "node"):
        try:
            result = subprocess.run(
                [runtime, "--version"],
                capture_output=True,
                check=True,
            )
            print(f"[wrapper] Using {runtime} v{result.stdout.decode().strip()}")
            return runtime
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue

    print("Error: Neither 'bun' nor 'node' is available.")
    print("Install one: https://bun.sh/ or https://nodejs.org/")
    sys.exit(1)


def _check_build() -> None:
    """Check that dist/cli.js exists. Exit with error if not."""
    if not CLI_JS.exists():
        print(f"Error: {CLI_JS} not found.")
        print("The TypeScript project has not been built yet.")
        print("Run one of:")
        print("  bun run build")
        print("  npm run build")
        sys.exit(1)


def main() -> None:
    runtime = _find_runtime()
    _check_build()

    # Transparently pass all environment variables (including OPENAI_* and TRANSLATE_*)
    env = os.environ.copy()

    # Forward all CLI arguments to the Node.js engine
    args = [runtime, str(CLI_JS)] + sys.argv[1:]
    result = subprocess.run(args, env=env)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()