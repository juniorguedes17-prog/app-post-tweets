/** Persistible timestamps use epoch milliseconds consistently across the domain. */
export type Timestamp = number

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

