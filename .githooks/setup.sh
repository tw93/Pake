#!/bin/bash
git config core.hooksPath .githooks
chmod +x .githooks/*
git config alias.add '!f() { npm run format && git add "$@"; }; f'