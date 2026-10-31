#!/bin/sh
# Usage: sh set-domain.sh https://vectofly.com   (no trailing slash)
[ -z "$1" ] && echo "Usage: sh set-domain.sh https://vectofly.com" && exit 1
for f in index.html how-to-play.html privacy.html terms.html contact.html about.html cookie-policy.html disclaimer.html dmca.html leaderboard.html robots.txt sitemap.xml; do
  sed -i.bak "s|https://vectofly.com|$1|g" "$f" && rm -f "$f.bak"
done
echo "Done. Domain set to $1"
