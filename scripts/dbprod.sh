#!/bin/bash

/Users/edwards/bin/rancher/rancher \
  kubectl -n egp-broker exec -it statefulset/egp-postgres -- \
  bash -c 'PGPASSWORD="${POSTGRES_PASSWORD}" psql -U $POSTGRES_USER -d $POSTGRES_DB'
