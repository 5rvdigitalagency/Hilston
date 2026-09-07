"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

// Only the centre of the frame is decoded, so a neighbouring ticket cannot be scanned by accident.
const SCAN_REGION_RATIO = 0.7;
const SCAN_INTERVAL_MS = 180;

export default function QrCamera({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const handledRef = useRef(false);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");

  function stopCamera() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }

  function scanFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || handledRef.current) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const side = Math.floor(Math.min(width, height) * SCAN_REGION_RATIO);
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, Math.floor((width - side) / 2), Math.floor((height - side) / 2), side, side, 0, 0, side, side);

    try {
      const result = readerRef.current?.decodeFromCanvas(canvas);
      if (result) {
        handledRef.current = true;
        stopCamera();
        onCode(result.getText());
      }
    } catch {
      // No code inside the aiming box on this frame.
    }
  }

  async function startCamera() {
    setMessage("");
    handledRef.current = false;
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setMessage("Camera access requires a secure HTTPS connection.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
      streamRef.current = stream;
      readerRef.current = readerRef.current ?? new BrowserMultiFormatReader();
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setActive(true);
      timerRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
    } catch {
      setMessage("Camera access was unavailable. Check your browser permission and use manual code entry instead.");
      stopCamera();
    }
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <div className={active ? "camera-scanner scanning" : "camera-scanner"}>
      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" muted playsInline aria-label="Live ticket QR camera preview" />
        <div className="camera-reticle" aria-hidden="true" />
      </div>
      {active && <p className="camera-hint">Hold one QR code inside the square</p>}
      <div className="camera-actions">
        {active
          ? <button type="button" className="secondary-button" onClick={stopCamera}>Stop camera</button>
          : <button type="button" className="primary-button" onClick={startCamera}>Start camera <span aria-hidden="true">&rarr;</span></button>}
      </div>
      {message && <p className="form-error" role="alert">{message}</p>}
    </div>
  );
}
