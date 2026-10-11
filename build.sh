#!/bin/sh
# Builds two pages from the same sources:
#   tridosha.html    single file, saves to the browser (or to Claude when published as an artifact)
#   docs/index.html  hosted site with Supabase accounts and profiles (reads docs/config.js)
set -e
HEAD='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>'
APP="10-data.js 20-engine.js 30-core.js 40-pages.js 45-pages2.js 50-actions.js"
{ echo "$HEAD</head><body>"; cat 00-head.html; echo '<script>'; cat $APP; echo '</script></body></html>'; } > tridosha.html
mkdir -p docs
{ echo "$HEAD"
  echo '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script><script src="config.js"></script></head><body>'
  cat 00-head.html; echo '<script>'; cat $APP 60-supabase.js; echo '</script></body></html>'; } > docs/index.html
touch docs/.nojekyll
echo "Built tridosha.html and docs/index.html"
