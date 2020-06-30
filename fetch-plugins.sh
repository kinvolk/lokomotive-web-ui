#!/bin/sh -e
#
# This script sets up the plugins for Lokomotive.
# It is just a temporary hack until we have a good way of fetching plugins already bundled
# and directly into js.

HEADLAMP_DIR=$1
PLUGINS_REPO=git@github.com:kinvolk/l8e-dashboard-plugins.git
PLUGINS_LOCAL="l8e-dashboard-plugins"
PLUGINS_FOLDER="$HEADLAMP_DIR"/frontend/src/plugin/plugins

pushd "$PLUGINS_FOLDER"

if [ -d $PLUGINS_LOCAL ]; then
  pushd $PLUGINS_LOCAL
  git pull origin master
  popd
else
  git clone "$PLUGINS_REPO" $PLUGINS_LOCAL
fi

# Create synlinks
for dir in $(find $PLUGINS_LOCAL/* -type d); do
  ln -s "$dir" 2> /dev/null || true
done

popd
