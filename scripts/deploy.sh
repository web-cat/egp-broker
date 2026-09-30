#!/bin/bash

# Check for unstaged or staged changes in tracked files only
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ Pause: There are uncommitted changes in tracked files."
    echo "Please commit or stash your changes before proceeding."

    git status

    exit 1
fi

echo "✅ No changes in tracked files."
git push
# for login shell
# ssh username@remote_host "/bin/bash -l -c 'command'"

ssh new-web-cat "/home/edwards/egp-broker/push.sh"

# rancher kubectl rollout restart deployment/<workload_name> -n <namespace_name>
#  --context c-m-wdjgsknc:p-pbkhk \

/Users/edwards/bin/rancher/rancher \
  kubectl rollout restart deployment/egp-broker-app -n egp-broker
