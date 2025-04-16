#!/usr/bin/env python
"""
Script to automatically fix linting issues in the project.

This script runs both Black and Ruff with fix enabled to automatically
format code and fix common linting issues in the project.
"""

import subprocess
import sys
from pathlib import Path

# Get the project root directory (assuming this script is in the scripts folder)
PROJECT_ROOT = Path(__file__).parent.parent


def run_command(command, description):
    """Run a command and print its output."""
    print(f"\n=== {description} ===")
    try:
        result = subprocess.run(
            command,
            cwd=PROJECT_ROOT,
            check=True,
            text=True,
            capture_output=True,
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        print(f"Output: {e.stdout}")
        print(f"Error: {e.stderr}")
        return False


def main():
    """Run Black and Ruff on the project."""
    # First run Black to format all files
    success = run_command(["black", "."], "Running Black formatter")
    if not success:
        print("Black formatting failed!")
        return 1

    # Then run Ruff to fix linting issues
    success = run_command(["ruff", "check", ".", "--fix", "--show-fixes"], "Running Ruff linter with auto-fix")
    if not success:
        print("Ruff auto-fixing failed!")
        return 1

    # Then run Ruff again to see if any issues remain
    success = run_command(["ruff", "check", "."], "Checking remaining issues with Ruff")
    if not success:
        print("\nSome linting issues could not be fixed automatically.")
        print("Please fix them manually. Common issues include:")
        print("  - F401: Remove unused imports")
        print("  - E722: Replace bare 'except:' with 'except Exception:'")
        print("  - F841: Remove unused variables or prefix with underscore")
        return 1

    print("\n✅ All linting issues have been fixed!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
