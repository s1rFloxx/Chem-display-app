#!/usr/bin/env bash
set -e
mkdir -p vendor/three/build vendor/three/examples/jsm/controls
curl -L --fail -o vendor/three/build/three.module.js https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js
curl -L --fail -o vendor/three/examples/jsm/controls/OrbitControls.js https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js
curl -L --fail -o vendor/three/LICENSE https://cdn.jsdelivr.net/npm/three@0.160.0/LICENSE
echo "Three.js 0.160.0 downloaded."
