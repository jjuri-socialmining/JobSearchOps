#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
generator_script="$script_dir/generate-vscode-moc.mjs"

node "$generator_script"
