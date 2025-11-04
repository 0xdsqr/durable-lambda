import {
  type EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge"
import { parseDuration } from "./utils"

export function createEventService(bus: EventBridgeClient, busName: string) {
  async function sleep(actorId: string, delay: string | number) {
    const ms = parseDuration(delay)
    await bus.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Time: new Date(Date.now() + ms),
            Source: "durable.lambda",
            DetailType: "TimerFired",
            Detail: JSON.stringify({ actorId }),
          },
        ],
      }),
    )
  }

  async function setAlarm(
    actorId: string,
    name: string,
    delay: string | number,
  ) {
    const ms = parseDuration(delay)
    const fireAt = new Date(Date.now() + ms)
    await bus.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Time: fireAt,
            Source: "durable.lambda",
            DetailType: "AlarmFired",
            Detail: JSON.stringify({ actorId, alarmName: name }),
          },
        ],
      }),
    )
  }

  async function signal(
    targetActor: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    await bus.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: "external.signal",
            DetailType: type,
            Detail: JSON.stringify({ actorId: targetActor, payload }),
          },
        ],
      }),
    )
  }

  return { sleep, setAlarm, signal }
}
