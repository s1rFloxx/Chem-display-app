$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "vendor/three/build" | Out-Null
New-Item -ItemType Directory -Force -Path "vendor/three/examples/jsm/controls" | Out-Null
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" -OutFile "vendor/three/build/three.module.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js" -OutFile "vendor/three/examples/jsm/controls/OrbitControls.js"
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/three@0.160.0/LICENSE" -OutFile "vendor/three/LICENSE"
Write-Host "Three.js 0.160.0 downloaded."
