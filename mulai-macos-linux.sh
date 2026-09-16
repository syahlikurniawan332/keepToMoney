#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
if [ ! -f .venv/arus-installed ]; then
  .venv/bin/python -m pip install -r requirements.txt
  touch .venv/arus-installed
fi
exec .venv/bin/python run.py
