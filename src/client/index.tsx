import "./styles.css";

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import createGlobe from "cobe";
import usePartySocket from "partysocket/react";

// The type of messages we'll be receiving from the server
import type { OutgoingMessage } from "../shared";

function App() {
\t// A reference to the canvas element where we'll render the globe
\tconst canvasRef = useRef<HTMLCanvasElement>(null);
\t// The number of markers we're currently displaying
\tconst [counter, setCounter] = useState(0);
\t// A map of marker IDs to their positions
\t// Note that we use a ref because the globe's `onRender` callback
\t// is called on every animation frame, and we don't want to re-render
\t// the component on every frame.
\tconst positions = useRef<
\t\tMap<
\t\t\tstring,
\t\t\t{
\t\t\t\tlocation: [number, number];
\t\t\t\tsize: number;
\t\t\t}
\t\t>
\t>(new Map());

\t// Connect to the PartyServer server
\tconst socket = usePartySocket({
\t\troom: "default",
\t\tparty: "globe",
\t\tonMessage(evt) {
\t\t\tconst message = JSON.parse(evt.data as string) as OutgoingMessage;

\t\t\tif (message.type === "add-marker") {
\t\t\t\t// Add the marker to our map
\t\t\t\tpositions.current.set(message.position.id, {
\t\t\t\t\tlocation: [message.position.lat, message.position.lng],
\t\t\t\t\tsize: message.position.id === socket.id ? 0.1 : 0.05,
\t\t\t\t});

\t\t\t\t// Update the counter
\t\t\t\tsetCounter((c) => c + 1);
\t\t\t} else {
\t\t\t\t// Remove the marker from our map
\t\t\t\tpositions.current.delete(message.id);

\t\t\t\t// Update the counter
\t\t\t\tsetCounter((c) => c - 1);
\t\t\t}
\t\t},
\t});

\tuseEffect(() => {
\t\tif (!canvasRef.current) return;

\t\t// The angle of rotation of the globe
\t\t// We'll update this on every frame to make the globe spin
\t\tlet phi = 0;

\t\tconst globe = createGlobe(canvasRef.current, {
\t\t\tdevicePixelRatio: 2,
\t\t\twidth: 400 * 2,
\t\t\theight: 400 * 2,
\t\t\tphi: 0,
\t\t\ttheta: 0,
\t\t\tdark: 1,
\t\t\tdiffuse: 0.8,
\t\t\tmapSamples: 16000,
\t\t\tmapBrightness: 6,
\t\t\tbaseColor: [0.3, 0.3, 0.3],
\t\t\tmarkerColor: [0.8, 0.1, 0.1],
\t\t\tglowColor: [0.2, 0.2, 0.2],
\t\t\tmarkers: [],
\t\t\topacity: 0.7,
\t\t\tonRender: (state) => {
\t\t\t\t// Called on every animation frame.
\t\t\t\t// `state` will be an empty object, return updated params.

\t\t\t\t// Get the current positions from our map
\t\t\t\tstate.markers = [...positions.current.values()];

\t\t\t\t// Rotate the globe
\t\t\t\tstate.phi = phi;
\t\t\t\tphi += 0.01;
\t\t\t},
\t\t});

\t\treturn () => {
\t\t\tglobe.destroy();
\t\t};
\t}, []);

\treturn (
\t\t<div className="App">
\t\t\t<h1>Where's everyone at?</h1>

\t\t\t{counter !== 0 ? (
\t\t\t\t<p>
\t\t\t\t\t<b>{counter}</b> {counter === 1 ? "person" : "people"} connected.
\t\t\t\t</p>
\t\t\t) : (
\t\t\t\t<p>&nbsp;</p>
\t\t\t)}

\t\t\t{/* The canvas where we'll render the globe */}
\t\t\t<canvas
\t\t\t\tref={canvasRef}
\t\t\t\tstyle={{ width: 400, height: 400, maxWidth: "100%", aspectRatio: 1 }}
\t\t\t/>
\t\t</div>
\t);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(<App />);