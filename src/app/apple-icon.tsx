import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The icon shown when the app is added to the phone's home screen.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#167a5b",
          color: "#ffffff",
          fontSize: 118,
          fontWeight: 600,
        }}
      >
        J
      </div>
    ),
    { ...size }
  );
}
