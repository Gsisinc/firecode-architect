import assert from "node:assert/strict";
import { detectRoomsFromImageData } from "./floorPlanDetection.js";

function makeImageData(width, height, draw) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }

  const dark = (x, y) => {
    const index = (y * width + x) * 4;
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
  };

  draw(dark);
  return { data, width, height };
}

function drawLine(dark, x1, y1, x2, y2) {
  if (x1 === x2) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y += 1) dark(x1, y);
    return;
  }

  if (y1 === y2) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += 1) dark(x, y1);
  }
}

const imageData = makeImageData(120, 100, (dark) => {
  [10, 60, 110].forEach((x) => drawLine(dark, x, 10, x, 90));
  [10, 50, 90].forEach((y) => drawLine(dark, 10, y, 110, y));
});

const result = detectRoomsFromImageData({
  imageData,
  activeFloor: 2,
  project: { default_ceiling_height: 11, default_ceiling_type: "open", gross_sqft_per_floor: [{ floor: 2, sqft: 800 }] },
  scaleToWidth: 240,
  scaleToHeight: 200,
});

assert.equal(result.rooms.length, 4);
assert.equal(result.rooms[0].floor, 2);
assert.equal(result.rooms[0].ceiling_height, 11);
assert.equal(result.rooms[0].generated_by, "local_room_detection");
assert.deepEqual(
  result.rooms.map((room) => [room.x, room.y, room.width, room.height]),
  [
    [20, 20, 100, 80],
    [120, 20, 100, 80],
    [20, 100, 100, 80],
    [120, 100, 100, 80],
  ]
);
assert.equal(result.geometry.buildingBounds.width, 200);
assert.ok(result.geometry.pxPerFt > 0);

console.log("floorPlanDetection tests passed");
