#!/bin/bash

echo "Starting asset watcher test..."
echo "This will test if new .vox files are automatically detected"
echo ""

# Start the watcher in the background
echo "Starting watcher..."
npm run watch-assets &
WATCHER_PID=$!

# Wait for watcher to start
sleep 3

echo ""
echo "Creating test .vox file in grass folder..."
# Create a simple test VOX file (minimal valid VOX structure)
# VOX header: "VOX " + version (150) + MAIN chunk
printf "VOX \x96\x00\x00\x00" > /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox
printf "MAIN\x00\x00\x00\x00\x28\x00\x00\x00" >> /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox
# SIZE chunk
printf "SIZE\x0C\x00\x00\x00\x00\x00\x00\x00" >> /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox
printf "\x05\x00\x00\x00\x05\x00\x00\x00\x05\x00\x00\x00" >> /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox
# XYZI chunk (empty)
printf "XYZI\x04\x00\x00\x00\x00\x00\x00\x00" >> /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox
printf "\x00\x00\x00\x00" >> /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox

echo "Waiting for detection..."
sleep 3

echo ""
echo "Checking if test_grass was added to assets.json..."
if grep -q "test_grass" /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/assets.json; then
    echo "✅ SUCCESS: test_grass.vox was detected and added!"
else
    echo "❌ FAILED: test_grass.vox was not detected"
fi

echo ""
echo "Cleaning up..."
rm -f /home/danger/Documents/GitHub/NeverEverLand/v007/public/assets/grass/test_grass.vox

# Kill the watcher
kill $WATCHER_PID 2>/dev/null

echo "Test complete!"