#!/usr/bin/env bash
set -euo pipefail

script_path="${BASH_SOURCE[0]}"
case "$script_path" in
  /*) ;;
  *) script_path="$PWD/$script_path" ;;
esac

script_dir="$(cd -- "$(dirname -- "$script_path")" && pwd -L)"

cd "$script_dir/../.."

bash "$script_dir/update-vscode-moc.sh"

printf '\nRefresh complete for VSCode.MOC\n'
read -r -p "Press Enter to close..."
