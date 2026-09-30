import "./styles.css";

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import createGlobe from "cobe";
import usePartySocket from "partysocket/react";

import type {
  IncomingMessage,
  OutgoingMessage,
  Position,
  Signal,
} from "../shared";

function hash(value: string) {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }

  return result;
}

function offsetPosition(position: Position) {
  const value = hash(position.id);
  const angle = ((value % 360) * Math.PI) / 180;
  const distance = 0.35;

  const lat = Math.max(
    -89,
    Math.min(89, position.lat + Math.sin(angle) * distance),
  );

  let lng = position.lng + Math.cos(angle) * distance;

  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;

  return {
    location: [lat, lng] as [number, number],
    size: 0.05,
  };
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);

  const [counter, setCounter] = useState(0);

  const people = useRef<Map<string, Position>>(new Map());
  const signals = useRef<Map<string, Signal>>(new Map());

  const socket = usePartySocket({
    room: "default",
    party: "globe",
    onMessage(evt) {
      const message = JSON.parse(evt.data as string) as OutgoingMessage;

      if (message.type === "add-marker") {
        const alreadyConnected = people.current.has(message.position.id);

        people.current.set(message.position.id, message.position);

        if (!alreadyConnected) {
          setCounter((count) => count + 1);
        }

        return;
      }

      if (message.type === "remove-marker") {
        const wasConnected = people.current.delete(message.id);

        if (wasConnected) {
          setCounter((count) => Math.max(0, count - 1));
        }

        return;
      }

      if (message.type === "sync-signals") {
        signals.current = new Map(
          message.signals.map((signal) => [signal.id, signal]),
        );

        return;
      }

      if (message.type === "add-signal") {
        signals.current.set(message.signal.id, message.signal);
      }
    },
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    let phi = 0;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 400 * 2,
      height: 400 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 0.8,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.8, 0.1, 0.1],
      glowColor: [0.2, 0.2, 0.2],
      markers: [],
      opacity: 0.7,
      onRender: (state) => {
        const visitorMarkers = [...people.current.values()].map((position) => {
          const marker = offsetPosition(position);

          return {
            ...marker,
            size: position.id === socket.id ? 0.08 : 0.05,
          };
        });

        const signalMarkers = [...signals.current.values()].map((signal) => {
          const marker = offsetPosition(signal);

          return {
            ...marker,
            size: 0.055,
          };
        });

        state.markers = [...visitorMarkers, ...signalMarkers];

        state.phi = phi;
        phiRef.current = phi;
        phi += 0.01;
      },
    });

    return () => {
      globe.destroy();
    };
  }, [socket.id]);

  function placeSignal(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    const radiusSquared = x * x + y * y;

    if (radiusSquared > 1) return;

    const z = Math.sqrt(1 - radiusSquared);
    const lat = (-Math.asin(y) * 180) / Math.PI;
    const lng =
      (Math.atan2(x, z) * 180) / Math.PI -
      (phiRef.current * 180) / Math.PI;

    const normalizedLng = ((lng + 540) % 360) - 180;

    const message: IncomingMessage = {
      type: "place-signal",
      lat,
      lng: normalizedLng,
    };

    socket.send(JSON.stringify(message));
  }

  return (
    <div className="App">
      <h1>Where's everyone at?</h1>

      {counter !== 0 ? (
        <p>
          <b>{counter}</b> {counter === 1 ? "person" : "people"} connected.
        </p>
      ) : (
        <p>&nbsp;</p>
      )}

      <canvas
        ref={canvasRef}
        onClick={placeSignal}
        style={{
          width: 400,
          height: 400,
          maxWidth: "100%",
          aspectRatio: 1,
          cursor: "crosshair",
        }}
      />

      <p>Tap the globe to leave a signal.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);