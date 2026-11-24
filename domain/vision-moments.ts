export type VisionMoment = { imageId?: string; text?: string };

/** Place both ordered streams on the same timeline without dropping or duplicating entries. */
export function visionMoments(images: readonly string[], fragments: readonly string[]): VisionMoment[] {
  const length = Math.max(images.length, fragments.length);
  const moments: VisionMoment[] = Array.from({ length }, () => ({}));
  images.forEach((imageId, index) => {
    moments[Math.ceil(index * length / images.length)].imageId = imageId;
  });
  fragments.forEach((text, index) => {
    moments[Math.ceil(index * length / fragments.length)].text = text;
  });
  return moments;
}
