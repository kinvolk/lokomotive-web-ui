#!/bin/bash -e
#
# This script builds the Lokomotive Web UI (based on Headlamp).
# Copyright © Kinvolk GmbH 2020
#
# Authors:
#  Joaquim Rocha <joaquim@kinvolk.io>

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]
Build a Lokomotive Dashboard image.

  --branch                      Headlamp branch to use
  -w,--workdir                  The workdir (if left empty, a temporary one will be used)
  -n, --dry-run                 Clone Headlamp and apply changes only
  -h, --help                    Display this help and exit

EOF
}

TOP_DIR=$(realpath "./$(dirname ${BASH_SOURCE[0]})")
BUILD_DIR=
REPO="https://github.com/kinvolk/headlamp.git"
BRANCH=master
PLUGINS_SRC_DIR="$TOP_DIR/plugins"
PLUGINS=$(ls ${PLUGINS_SRC_DIR})
DRY_RUN=

ARGS=$(getopt -o "b:w:nh" -l "branch:,workdir:,dry-run,help" \
  -n "build.sh" -- "$@")
eval set -- "$ARGS"

while true; do
  case "$1" in
    -b|--branch)
      BRANCH=$2
      shift 2
      ;;
    -n|--dry-run)
      DRY_RUN=true
      shift
    ;;
    -w|--workdir)
      BUILD_DIR=$(realpath $2)
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

RM_DIR=true

if [ -z "$BUILD_DIR" ]; then
    BUILD_DIR="$(mktemp -d)"
    RM_DIR=false
fi

mkdir -p $BUILD_DIR

echo "Getting Headlamp"
echo

git clone --depth 1 $REPO $BUILD_DIR -b $BRANCH

echo
echo "Branding Headlamp"
echo

pushd $BUILD_DIR #> /dev/null

# Patches
for i in $(find "$TOP_DIR/patches/" -name "*.patch"); do
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

PLUGINS_DIR="${BUILD_DIR}/plugins"

mkdir -p ${PLUGINS_DIR}

for i in ${PLUGINS[@]}
do
    pushd "${PLUGINS_SRC_DIR}/$i"
    npm install && npm run build
    popd
done

npx @kinvolk/headlamp-plugin extract "${PLUGINS_SRC_DIR}" "${PLUGINS_DIR}"

# Return value
ret=0

if [ ! -z $DRY_RUN ]; then
    exit $ret
fi

echo
echo "Creating container..."
echo

DOCKER_IMAGE_NAME=lokomotive-web-ui make image || ret=$?

echo

if [ $ret -ne 0 ]; then
  echo "Problem making L8e Dashboard container!"
else
  echo "L8e Dashboard container successfully created!"
fi

if [ $RM_DIR = "true" ]; then
    rm -rf $BUILD_DIR
fi

popd > /dev/null

exit $ret
