#!/bin/sh
set -eu

./node_modules/.bin/prisma db push
exec node server.js
