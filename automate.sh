#!/bin/bash

# Build images
docker-compose build

# Tag and push images
for image in $(docker-compose config | grep image: | awk '{print $2}'); do
    image_name=$(echo $image | cut -d':' -f1)
    tag=$(echo $image | cut -d':' -f2)
    new_tag="docker.cs.vt.edu/stedwar2/egp-broker/$(basename $image_name):$tag"
    
    docker tag $image $new_tag
    docker push $new_tag
done