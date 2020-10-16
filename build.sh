#!/bin/bash -e
#
# This script builds the Lokomotive Dashboard (based on Headlamp).
# Copyright © Kinvolk GmbH 2020
#
# Authors:
#  Joaquim Rocha <joaquim@kinvolk.io>

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]
Build a Lokomotive Dashboard image.

  --branch                      Headlamp branch to use
  -h, --help                    Display this help and exit

EOF
}

TOP_DIR=$(realpath "./$(dirname ${BASH_SOURCE[0]})")
BUILD_DIR="$(mktemp -d)"
REPO="https://github.com/kinvolk/headlamp.git"
BRANCH=master
PLUGINS_DIR="$TOP_DIR/plugins"
PLUGINS=$(ls ${PLUGINS_DIR})

ARGS=$(getopt -o "b:h" -l "branch:,help" \
  -n "build.sh" -- "$@")
eval set -- "$ARGS"

while true; do
  case "$1" in
    -b|--branch)
      BRANCH=$2
      shift 2
      ;;
    -h|--help)
    usage
    exit 0
    ;;
    --)
      shift
      break
      ;;
  esac
done

declare -A ASSETS
ASSETS["$TOP_DIR/assets/lokomotive-logo.svg"]="./frontend/src/resources/logo-light.svg"

mkdir -p $BUILD_DIR

echo "Getting Headlamp"
echo

git clone --depth 1 $REPO $BUILD_DIR -b $BRANCH

echo
echo "Branding Headlamp"
echo

pushd $BUILD_DIR #> /dev/null

# Patches
for i in $(find "$TOPDIR/patches/" -name "*.patch"); do
    git apply $i
done

# Assets
for i in "${!ASSETS[@]}"
do
    echo "Copying $i -> ${ASSETS[$i]}"
    cp $i ${ASSETS[$i]}
done

echo
echo "Adding L8e plugins"
echo

for i in ${PLUGINS[@]}
do
    cd "${PLUGINS_DIR}/$i" && npm install && npm run build 
    echo "Creating $i in plugins dir at project backend"
    cd "${BUILD_DIR}"
    mkdir -p "./plugins/$i"

    echo "Copying plugins/$i/dist/main.js"
    cp -R "${PLUGINS_DIR}/$i/dist/main.js" "./plugins/$i"
done


# Return value
ret=0

echo
echo "Creating container..."
echo

make image || ret=$?

echo

if [ $ret -ne 0 ]; then
  echo "Problem making L8e Dashboard container!"
else
  echo "L8e Dashboard container successfully created!"
fi

rm -rf $BUILD_DIR

popd > /dev/null

exit $ret
