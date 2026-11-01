#!/bin/sh
# The site is already set up for https://vectofly.com. Only use this if you ever move to another domain:
# sh set-domain.sh https://newdomain.com   (no trailing slash)
[ -z "$1" ] && echo "Usage: sh set-domain.sh https://newdomain.com" && exit 1
for f in index.html *.html robots.txt sitemap.xml; do
  sed -i.bak "s|https://vectofly.com|$1|g" "$f" && rm -f "$f.bak"
done
echo "Done. Domain set to $1"
