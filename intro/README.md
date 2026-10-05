# Interactive eye hero

Open index.html in a modern browser. No build step or dependencies required.

ENTER triggers a roughly two-second brand transition: the eye centers, the triangle moves into the original full logo, the ring and lettering are revealed, the supplied logo is held, and it docks at the top left. The image assets are not regenerated. The full logo is displayed as supplied on the black background. Reduced motion skips movement.

The destination is unconfigured. Set `data-enter-url` on the button to navigate after the transition, add a hidden `[data-site-content]` element after the hero to reveal content automatically, or listen for the bubbling `hero:entered` event. When content is supplied, the hero becomes a compact header so the content is visible immediately. Without a destination or site content, the preview ends with the header logo.

This version is permanently dark, with a pure black background and no theme toggle. Device preferences and earlier saved theme choices do not affect it. The triangle and eye keep their original colors. A display filter maps near-white video compression blocks (249–255) to pure white while preserving darker details; the source image stays untouched.

The default version uses the original high-resolution first frame with its existing pupil isolated as a rigid canvas layer. Only its position changes. This gives continuous two-axis tracking without changing pupil shape or playing unrelated video frames. The complete composition stays centered, the eye outline remains fixed, and the original first frame is restored exactly at idle. Motion eases in coordinate space and respects reduced-motion preferences.

## Original frame mode

Add `?mode=frames` to the page URL to use the video-based version. The 301-frame horizontal sprite sheet remains included. gaze-map.js contains measured gaze coordinates for every source frame, obtained from the pupil highlight. Frame selection uses the closest actual gaze, with hysteresis, rather than interpolating frame numbers. This corrects the old direction mapping and eliminates temporal sweeps through unrelated poses. The source video has a sparse gaze trajectory; this mode cannot supply every intermediate 2D direction or remove source pupil deformations. The default rigid mode resolves those limitations.

The source is 10.033 seconds at 30 fps, 1920 × 1080. The single horizontal sheet includes all 301 frames at 192 × 108 (57,792 × 108 total), below common browser image width limits. Frames soften when enlarged. The default renderer uses the full-resolution idle image instead.

## Assets

- assets/eye-idle.png: untouched first frame extracted with FFmpeg.
- assets/eye-sprite.png: all frames in chronological order.
- gaze-map.js: calibrated source-frame gaze coordinates.
- hero.js: pointer tracking, easing, rendering, and return to idle.

To replace the source artwork, recalibrate the iris position, eye-opening path, and gaze data. The current coordinates are specific to the uploaded clip.
