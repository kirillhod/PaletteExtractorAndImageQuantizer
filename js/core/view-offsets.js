// @ts-check

/**
 * Keep the image point under the frame center fixed when the frame changes size
 * without a refit. Half of the size delta moves the old offsets with the center,
 * so a panel opening or closing does not push the image off-center.
 *
 * @param {{ offsetX:number, offsetY:number }} offsets
 * @param {{ width:number, height:number }} size
 * @param {{ width:number, height:number }} previous
 * @returns {{ offsetX:number, offsetY:number }}
 */
export function recenterOffsets(offsets, size, previous) {
  return {
    offsetX: offsets.offsetX + (size.width - previous.width) / 2,
    offsetY: offsets.offsetY + (size.height - previous.height) / 2,
  };
}
