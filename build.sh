#!/bin/bash -e
#
# This script builds the Lokomotive Dashboard (based on Headlamp).
#

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]
Build a Lokomotive Dashboard image.

  --branch                      Nebraska branch to use
  -h, --help                    Display this help and exit

EOF
}

TOPDIR="`pwd`/$(dirname ${BASH_SOURCE[0]})"
BUILD_DIR="$(mktemp -d)"
REPO="https://github.com/kinvolk/headlamp.git"
BRANCH=master
BASE_DIR=$(realpath "./")

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
ASSETS["$TOPDIR/lokomotive-logo.svg"]="./frontend/src/resources/logo-light.svg"
#ASSETS["$TOPDIR/config/.env"]="./frontend/.env"

mkdir -p $BUILD_DIR

echo "Getting Headlamp"
echo

git clone --depth 1 $REPO $BUILD_DIR -b $BRANCH

echo
echo "Branding Headlamp"
echo

pushd $BUILD_DIR #> /dev/null

for i in "${!ASSETS[@]}"
do
    echo "Copying $i -> ${ASSETS[$i]}"
    cp $i ${ASSETS[$i]}
done

# Return value
ret=0

$BASE_DIR/fetch-plugins.sh $BUILD_DIR

exit $ret

echo
echo "Creating container..."
echo

make image || ret=$?

echo

if [ $ret -ne 0 ]; then
    echo "Problem making Nebraska container!"
else
    echo "Nebraska container successfully created!"
fi

rm -rf $BUILD_DIR

popd > /dev/null

exit $ret
