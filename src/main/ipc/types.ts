import type { Channel, OutputOf, ParsedInputOf } from '@shared/ipc/contract';

export type Handler<C extends Channel> = (
  input: ParsedInputOf<C>,
) => OutputOf<C> | Promise<OutputOf<C>>;

/** A complete handler table: the compiler rejects a missing or mistyped channel. */
export type HandlerTable = { [C in Channel]: Handler<C> };

export type PartialHandlerTable = { [C in Channel]?: Handler<C> };
