#!/bin/sh
# Wraps the page content in a document so it opens directly in a browser.
{ echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style></head><body>'
  cat 00-head.html; echo '<script>'; cat 10-data.js 20-engine.js 30-core.js 40-pages.js 45-pages2.js 50-actions.js; echo '</script></body></html>'; } > tridosha.html
