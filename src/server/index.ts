import { routePartykitRequest, Server } from "partyserver";

import type {
  IncomingMessage,
  OutgoingMessage,
  Position,
  Signal,
} from "../shared";
import type { Connection, ConnectionContext } from "partyserver";

type ConnectionState = {
  position?: Position;
  lastSignalAt?: number;
};

const SIGNALS_KEY = "public-signals";
const MAX_SIGNALS = 500;
const SIGNAL_COOLDOWN_MS = 2000;

export class Globe extends Server {
  async onConnect(
    conn: Connection<ConnectionState>,
    ctx: ConnectionContext,
  ): Promise<void> {
    const signals =
      (await this.ctx.storage.get<Signal[]>(SIGNALS_KEY)) ?? [];

    conn.send(
      JSON.stringify({
        type: "sync-signals",
        signals,
      } satisfies OutgoingMessage),
    );

    const latitude = ctx.request.cf?.latitude as string | undefined;
    const longitude = ctx.request.cf?.longitude as string | undefined;

    if (!latitude || !longitude) {
      console.warn(`Missing position information for connection ${conn.id}`);
      return;
    }

    const position: Position = {
      lat: parseFloat(latitude),
      lng: parseFloat(longitude),
      id: conn.id,
    };

    conn.setState({ position });

    for (const connection of this.getConnections<ConnectionState>()) {
      const existingPosition = connection.state?.position;

      if (!existingPosition) {
        continue;
      }

      conn.send(
        JSON.stringify({
          type: "add-marker",
          position: existingPosition,
        } satisfies OutgoingMessage),
      );

      if (connection.id !== conn.id) {
        connection.send(
          JSON.stringify({
            type: "add-marker",
            position,
          } satisfies OutgoingMessage),
        );
      }
    }
  }

  async onMessage(
    conn: Connection<ConnectionState>,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message !== "string") {
      return;
    }

    let payload: IncomingMessage;

    try {
      payload = JSON.parse(message) as IncomingMessage;
    } catch {
      return;
    }

    if (payload.type !== "place-signal") {
      return;
    }

    if (
      !Number.isFinite(payload.lat) ||
      !Number.isFinite(payload.lng) ||
      payload.lat < -90 ||
      payload.lat > 90 ||
      payload.lng < -180 ||
      payload.lng > 180
    ) {
      return;
    }

    const now = Date.now();
    const state = conn.state ?? {};

    if (
      state.lastSignalAt &&
      now - state.lastSignalAt < SIGNAL_COOLDOWN_MS
    ) {
      return;
    }

    conn.setState({
      ...state,
      lastSignalAt: now,
    });

    const signal: Signal = {
      id: crypto.randomUUID(),
      lat: payload.lat,
      lng: payload.lng,
      createdAt: now,
    };

    const signals =
      (await this.ctx.storage.get<Signal[]>(SIGNALS_KEY)) ?? [];

    signals.push(signal);

    if (signals.length > MAX_SIGNALS) {
      signals.splice(0, signals.length - MAX_SIGNALS);
    }

    await this.ctx.storage.put(SIGNALS_KEY, signals);

    this.broadcast(
      JSON.stringify({
        type: "add-signal",
        signal,
      } satisfies OutgoingMessage),
    );
  }

  onCloseOrError(connection: Connection<ConnectionState>) {
    this.broadcast(
      JSON.stringify({
        type: "remove-marker",
        id: connection.id,
      } satisfies OutgoingMessage),
      [connection.id],
    );
  }

  onClose(connection: Connection<ConnectionState>): void {
    this.onCloseOrError(connection);
  }

  onError(connection: Connection<ConnectionState>): void {
    this.onCloseOrError(connection);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, { ...env })) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;