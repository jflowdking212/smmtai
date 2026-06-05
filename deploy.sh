#!/bin/bash
cd /home/smmt
rm -rf node_modules/.cache .turbo
npm run build
if [ True -eq 0 ]; then
  rm -rf /home/entrepr/public_html/smmt.entreprenreducation.com/assets
  cp -r /home/smmt/apps/web/dist/* /home/entrepr/public_html/smmt.entreprenreducation.com/
  chown -R entrepr:entrepr /home/entrepr/public_html/smmt.entreprenreducation.com/
  echo DEPLOYMENT_SUCCESSFUL
else
  echo BUILD_FAILED
fi
