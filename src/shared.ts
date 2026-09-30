export type Position = {
  lat: number;
  lng: number;
  id: string;
};

export type Signal = Position & {
  createdAt: number;
};

export type OutgoingMessage =
  | {
      type: "add-marker";
      position: Position;
    }
  | {
      type: "remove-marker";
      id: string;
    }
  | {
      type: "sync-signals";
      signals: Signal[];
    }
  | {
      type: "add-signal";
      signal: Signal;
    };

export type IncomingMessage = {
  type: "place-signal";
  lat: number;
  lng: number;
};