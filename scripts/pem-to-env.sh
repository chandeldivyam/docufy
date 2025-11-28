#!/usr/bin/env bash
# Usage: ./pem-to-env.sh path/to/key.pem
# Output: prints a single-line string with \n for newlines

if [ $# -ne 1 ]; then
  echo "Usage: $0 path/to/key.pem"
  exit 1
fi

file="$1"

# Read the file, escape newlines as literal "\n", and wrap in quotes
escaped=$(awk 'BEGIN { ORS=""; } { gsub(/\\/, "\\\\"); printf "%s\\n", $0 } END { printf "\n" }' "$file")

echo "\"$escaped\""
