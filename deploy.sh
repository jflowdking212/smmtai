#!/bin/bash
set -e
cd /home/smmt
rm -rf node_modules/.cache .turbo
npm run build
BUILD_EXIT=$?
if [ $BUILD_EXIT -eq 0 ]; then
  rm -rf /home/entrepr/public_html/smmtai.com/assets
  cp -r /home/smmt/apps/web/dist/* /home/entrepr/public_html/smmtai.com/
  chown -R entrepr:entrepr /home/entrepr/public_html/smmtai.com/
  echo DEPLOYMENT_SUCCESSFUL
else
  echo BUILD_FAILED
  exit 1
fi
